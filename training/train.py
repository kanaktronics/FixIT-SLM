"""
FIXIT SLM — QLoRA Fine-Tuning Script
=====================================
Fine-tunes Phi-3 Mini 3.8B on the FIXIT SLM dataset using QLoRA
(4-bit quantization + Low-Rank Adaptation).

Hardware requirements:
  - Minimum: 6GB VRAM (RTX 3050 / 4060)
  - Recommended: 8GB+ VRAM (RTX 3060 / 4070)
  - RAM: 16GB minimum

Usage:
    python train.py --dataset ./dataset/fixit_train.jsonl --output ./checkpoints

On Vertex AI (GCP — placeholder):
    python train.py \
        --dataset gs://fixit-slm-artifacts/dataset/fixit_train.jsonl \
        --output gs://fixit-slm-artifacts/checkpoints/ \
        --use_gcs
"""

import os
import argparse
import logging
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

from datasets import load_dataset
import torch
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
    set_seed,
)
from peft import (
    LoraConfig,
    TaskType,
    get_peft_model,
    prepare_model_for_kbit_training,
)
from trl import SFTTrainer
import bitsandbytes as bnb

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class FIXITTrainingConfig:
    # Model
    base_model: str = "microsoft/Phi-3-mini-4k-instruct"
    model_revision: str = "main"

    # Dataset
    dataset_path: str = "./dataset/fixit_train.jsonl"
    val_split: float = 0.05           # 5% held out for validation
    max_seq_length: int = 1024        # Max token length per example

    # LoRA
    lora_r: int = 16                  # LoRA rank
    lora_alpha: int = 32              # LoRA alpha (scaling)
    lora_dropout: float = 0.05
    lora_target_modules: list = field(default_factory=lambda: [
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj"
    ])

    # Quantization
    load_in_4bit: bool = True
    bnb_4bit_compute_dtype: str = "bfloat16"
    bnb_4bit_quant_type: str = "nf4"
    bnb_4bit_use_double_quant: bool = True

    # Training
    num_epochs: int = 3
    per_device_train_batch_size: int = 2
    per_device_eval_batch_size: int = 2
    gradient_accumulation_steps: int = 4  # Effective batch = 2×4 = 8
    learning_rate: float = 2e-4
    weight_decay: float = 0.001
    warmup_ratio: float = 0.03
    lr_scheduler_type: str = "cosine"
    optim: str = "paged_adamw_8bit"    # Memory-efficient optimizer
    max_grad_norm: float = 0.3

    # Checkpointing
    output_dir: str = "./checkpoints"
    save_steps: int = 100
    eval_steps: int = 100
    logging_steps: int = 25
    save_total_limit: int = 3

    # GCS (placeholder — set use_gcs=True when GCP is configured)
    use_gcs: bool = False
    gcs_bucket: str = "fixit-slm-artifacts"

    # Reproducibility
    seed: int = 42


# ─────────────────────────────────────────────────────────────────────────────
# GCS Utilities (placeholder)
# ─────────────────────────────────────────────────────────────────────────────

def download_from_gcs(gcs_path: str, local_path: str) -> str:
    """
    [GCP PLACEHOLDER] Download a file from Google Cloud Storage.
    Uncomment and implement when GCP is configured.
    """
    # TODO: Enable when GCP is set up
    # from google.cloud import storage
    # client = storage.Client()
    # bucket_name = gcs_path.replace("gs://", "").split("/")[0]
    # blob_path = "/".join(gcs_path.replace("gs://", "").split("/")[1:])
    # bucket = client.bucket(bucket_name)
    # blob = bucket.blob(blob_path)
    # blob.download_to_filename(local_path)
    # logger.info(f"Downloaded {gcs_path} → {local_path}")
    raise NotImplementedError(
        "GCS download not yet configured. "
        "Run with local dataset path and --use_gcs=False"
    )


def upload_to_gcs(local_path: str, gcs_path: str) -> None:
    """
    [GCP PLACEHOLDER] Upload a file or directory to Google Cloud Storage.
    Uncomment and implement when GCP is configured.
    """
    # TODO: Enable when GCP is set up
    # from google.cloud import storage
    # client = storage.Client()
    # ...
    logger.warning(
        f"GCS upload skipped (not configured). "
        f"Model saved locally at: {local_path}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Dataset Loading
# ─────────────────────────────────────────────────────────────────────────────

def load_fixit_dataset(config: FIXITTrainingConfig):
    """Load and split the FIXIT JSONL dataset."""

    dataset_path = config.dataset_path

    # [GCP PLACEHOLDER] Download from GCS if configured
    if config.use_gcs and dataset_path.startswith("gs://"):
        local_dataset = "/tmp/fixit_train.jsonl"
        download_from_gcs(dataset_path, local_dataset)
        dataset_path = local_dataset

    logger.info(f"Loading dataset from: {dataset_path}")

    dataset = load_dataset("json", data_files=dataset_path, split="train")
    logger.info(f"Loaded {len(dataset)} examples")

    # Train / validation split
    split = dataset.train_test_split(
        test_size=config.val_split,
        seed=config.seed
    )

    logger.info(
        f"Split: {len(split['train'])} train | {len(split['test'])} validation"
    )
    return split["train"], split["test"]


# ─────────────────────────────────────────────────────────────────────────────
# Model Loading
# ─────────────────────────────────────────────────────────────────────────────

def load_model_and_tokenizer(config: FIXITTrainingConfig):
    """Load Phi-3 Mini in 4-bit and prepare for QLoRA training."""

    compute_dtype = getattr(torch, config.bnb_4bit_compute_dtype)

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=config.load_in_4bit,
        bnb_4bit_compute_dtype=compute_dtype,
        bnb_4bit_quant_type=config.bnb_4bit_quant_type,
        bnb_4bit_use_double_quant=config.bnb_4bit_use_double_quant,
    )

    logger.info(f"Loading base model: {config.base_model}")
    logger.info(f"Quantization: 4-bit ({config.bnb_4bit_quant_type})")

    model = AutoModelForCausalLM.from_pretrained(
        config.base_model,
        revision=config.model_revision,
        quantization_config=bnb_config,
        device_map={"": torch.cuda.current_device()},
        trust_remote_code=True,
        torch_dtype=compute_dtype,
        attn_implementation="eager",
    )

    model.config.use_cache = False
    model.config.pretraining_tp = 1

    # Prepare for k-bit training
    model = prepare_model_for_kbit_training(model)

    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(
        config.base_model,
        trust_remote_code=True,
    )

    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
        tokenizer.pad_token_id = tokenizer.eos_token_id

    tokenizer.padding_side = "right"

    logger.info(
        f"Model loaded. Parameters: {model.num_parameters() / 1e9:.1f}B"
    )
    return model, tokenizer


# ─────────────────────────────────────────────────────────────────────────────
# LoRA Setup
# ─────────────────────────────────────────────────────────────────────────────

def apply_lora(model, config: FIXITTrainingConfig):
    """Apply LoRA adapters to the model."""

    lora_config = LoraConfig(
        r=config.lora_r,
        lora_alpha=config.lora_alpha,
        target_modules=config.lora_target_modules,
        lora_dropout=config.lora_dropout,
        bias="none",
        task_type=TaskType.CAUSAL_LM,
    )

    model = get_peft_model(model, lora_config)

    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_params = sum(p.numel() for p in model.parameters())
    logger.info(
        f"LoRA applied. Trainable params: {trainable_params / 1e6:.1f}M "
        f"({100 * trainable_params / total_params:.2f}% of {total_params / 1e9:.1f}B)"
    )

    return model


# ─────────────────────────────────────────────────────────────────────────────
# Formatting
# ─────────────────────────────────────────────────────────────────────────────

def format_chatml(example: dict, tokenizer) -> dict:
    """
    Convert ChatML messages to the model's chat template format.
    Phi-3 Mini uses a specific chat template for instruction following.
    """
    messages = example["messages"]
    text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=False,
    )
    return {"text": text}


# ─────────────────────────────────────────────────────────────────────────────
# Training
# ─────────────────────────────────────────────────────────────────────────────

def train(config: FIXITTrainingConfig):
    """Main training function."""

    set_seed(config.seed)

    # Check GPU
    if not torch.cuda.is_available():
        logger.warning("No CUDA GPU detected. Training on CPU will be very slow.")
        logger.warning("For RTX 3050: ensure CUDA 12.1+ and PyTorch CUDA build are installed.")
    else:
        gpu_name = torch.cuda.get_device_name(0)
        gpu_vram = torch.cuda.get_device_properties(0).total_memory / 1e9
        logger.info(f"GPU: {gpu_name} ({gpu_vram:.1f} GB VRAM)")

        if gpu_vram < 5.5:
            logger.warning(
                "Less than 5.5GB VRAM detected. Reduce batch_size to 1 "
                "and increase gradient_accumulation_steps to 8."
            )

    # Load dataset
    train_dataset, eval_dataset = load_fixit_dataset(config)

    # Load model
    model, tokenizer = load_model_and_tokenizer(config)

    # Apply LoRA
    model = apply_lora(model, config)

    # Format dataset
    train_dataset = train_dataset.map(
        lambda x: format_chatml(x, tokenizer),
        desc="Formatting train dataset",
    )
    eval_dataset = eval_dataset.map(
        lambda x: format_chatml(x, tokenizer),
        desc="Formatting eval dataset",
    )

    # Training arguments
    output_dir = Path(config.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    training_args = TrainingArguments(
        output_dir=str(output_dir),
        num_train_epochs=config.num_epochs,
        per_device_train_batch_size=config.per_device_train_batch_size,
        per_device_eval_batch_size=config.per_device_eval_batch_size,
        gradient_accumulation_steps=config.gradient_accumulation_steps,
        gradient_checkpointing=True,          # Saves VRAM at cost of ~20% speed
        gradient_checkpointing_kwargs={"use_reentrant": False},
        learning_rate=config.learning_rate,
        weight_decay=config.weight_decay,
        warmup_ratio=config.warmup_ratio,
        lr_scheduler_type=config.lr_scheduler_type,
        optim=config.optim,
        max_grad_norm=config.max_grad_norm,
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        logging_steps=config.logging_steps,
        save_steps=config.save_steps,
        eval_steps=config.eval_steps,
        evaluation_strategy="steps",
        save_strategy="steps",
        save_total_limit=config.save_total_limit,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        report_to="none",                     # Set to "wandb" if you want experiment tracking
        seed=config.seed,
        dataloader_num_workers=0,             # Windows compatibility
        remove_unused_columns=True,
    )

    # Initialize trainer
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        dataset_text_field="text",
        max_seq_length=config.max_seq_length,
        args=training_args,
    )

    logger.info("=" * 60)
    logger.info("FIXIT SLM — Starting QLoRA Fine-Tuning")
    logger.info(f"  Base model:  {config.base_model}")
    logger.info(f"  Train size:  {len(train_dataset)}")
    logger.info(f"  Val size:    {len(eval_dataset)}")
    logger.info(f"  Epochs:      {config.num_epochs}")
    logger.info(f"  Batch size:  {config.per_device_train_batch_size} × {config.gradient_accumulation_steps} steps")
    logger.info(f"  Output:      {config.output_dir}")
    logger.info("=" * 60)

    # Train
    trainer.train()

    logger.info("Training complete. Saving final model...")

    # Save LoRA adapter
    lora_output = output_dir / "fixit-lora-final"
    trainer.model.save_pretrained(str(lora_output))
    tokenizer.save_pretrained(str(lora_output))

    logger.info(f"LoRA adapter saved to: {lora_output}")

    # [GCP PLACEHOLDER] Upload to GCS
    if config.use_gcs:
        gcs_dest = f"gs://{config.gcs_bucket}/lora/{lora_output.name}"
        upload_to_gcs(str(lora_output), gcs_dest)

    logger.info("\nNext step: run merge_model.py to merge LoRA weights and export to GGUF.")
    logger.info(f"  python merge_model.py --lora_path {lora_output}")


# ─────────────────────────────────────────────────────────────────────────────
# CLI Entry Point
# ─────────────────────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(description="FIXIT SLM QLoRA Fine-Tuning")
    parser.add_argument("--dataset", type=str, default="./dataset/fixit_train.jsonl")
    parser.add_argument("--output", type=str, default="./checkpoints")
    parser.add_argument("--base_model", type=str, default="microsoft/Phi-3-mini-4k-instruct")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch_size", type=int, default=2)
    parser.add_argument("--grad_accum", type=int, default=4)
    parser.add_argument("--lora_r", type=int, default=16)
    parser.add_argument("--learning_rate", type=float, default=2e-4)
    parser.add_argument("--max_seq_length", type=int, default=1024)
    parser.add_argument("--use_gcs", action="store_true", default=False,
                        help="[Placeholder] Use GCS for dataset and output")
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    config = FIXITTrainingConfig(
        dataset_path=args.dataset,
        output_dir=args.output,
        base_model=args.base_model,
        num_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        lora_r=args.lora_r,
        learning_rate=args.learning_rate,
        max_seq_length=args.max_seq_length,
        use_gcs=args.use_gcs,
        seed=args.seed,
    )

    train(config)
