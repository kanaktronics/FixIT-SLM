"""
FIXIT SLM — Model Merge + GGUF Export
======================================
Merges LoRA adapter weights with the base model,
saves the merged model, and exports to GGUF format for Ollama serving.

Requirements:
  - Completed training run (fixit-lora-final directory)
  - llama.cpp installed (for GGUF conversion)
  - Sufficient RAM (≥16GB recommended for Phi-3 Mini merge)

Usage:
    python merge_model.py \
        --lora_path ./checkpoints/fixit-lora-final \
        --output_dir ./merged \
        --gguf_dir ./gguf \
        --quantization Q4_K_M

On GCP (placeholder):
    python merge_model.py \
        --lora_path gs://fixit-slm-artifacts/lora/fixit-lora-final \
        --output_dir gs://fixit-slm-artifacts/merged/ \
        --gguf_dir gs://fixit-slm-artifacts/gguf/ \
        --use_gcs
"""

import os
import sys
import shutil
import argparse
import logging
import subprocess
from pathlib import Path
from typing import Optional

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# GCS Utilities (placeholder)
# ─────────────────────────────────────────────────────────────────────────────

def sync_from_gcs(gcs_path: str, local_path: str) -> None:
    """[GCP PLACEHOLDER] Sync directory from GCS."""
    # TODO: Enable when GCP is configured
    # import subprocess
    # subprocess.run(["gsutil", "-m", "cp", "-r", gcs_path, local_path], check=True)
    raise NotImplementedError("GCS not configured. Use local paths.")


def sync_to_gcs(local_path: str, gcs_path: str) -> None:
    """[GCP PLACEHOLDER] Sync directory to GCS."""
    # TODO: Enable when GCP is configured
    # import subprocess
    # subprocess.run(["gsutil", "-m", "cp", "-r", local_path, gcs_path], check=True)
    logger.warning(f"GCS upload skipped. Files at: {local_path}")


# ─────────────────────────────────────────────────────────────────────────────
# Step 1: Merge LoRA into base model
# ─────────────────────────────────────────────────────────────────────────────

def merge_lora(
    base_model_name: str,
    lora_path: str,
    output_dir: str,
) -> None:
    """Load base model + LoRA adapter, merge weights, save full model."""

    logger.info("=" * 60)
    logger.info("Step 1: Merging LoRA adapter into base model")
    logger.info(f"  Base model:  {base_model_name}")
    logger.info(f"  LoRA path:   {lora_path}")
    logger.info(f"  Output:      {output_dir}")
    logger.info("=" * 60)

    logger.info("Loading base model in float16 for merge...")
    base_model = AutoModelForCausalLM.from_pretrained(
        base_model_name,
        torch_dtype=torch.float16,
        device_map="cpu",          # Merge on CPU to avoid VRAM limits
        trust_remote_code=True,
        low_cpu_mem_usage=True,
    )

    logger.info("Loading LoRA adapter...")
    model = PeftModel.from_pretrained(
        base_model,
        lora_path,
        torch_dtype=torch.float16,
    )

    logger.info("Merging LoRA weights into base model (this may take a few minutes)...")
    model = model.merge_and_unload()

    logger.info("Saving merged model...")
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    model.save_pretrained(output_dir, safe_serialization=False, max_shard_size="1GB")

    logger.info("Saving tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(lora_path, trust_remote_code=True)
    tokenizer.save_pretrained(output_dir)

    logger.info(f"Merged model saved to: {output_dir}")


# ─────────────────────────────────────────────────────────────────────────────
# Step 2: Convert to GGUF using llama.cpp
# ─────────────────────────────────────────────────────────────────────────────

def convert_to_gguf(
    merged_dir: str,
    gguf_dir: str,
    quantization: str = "Q4_K_M",
    llama_cpp_path: Optional[str] = None,
) -> str:
    """
    Convert safetensors model to GGUF format using llama.cpp.

    Quantization options:
      Q2_K   — Smallest, lowest quality (~1.5GB for 3.8B model)
      Q4_K_M — Best size/quality balance (~2.2GB for 3.8B model)  [RECOMMENDED]
      Q5_K_M — Higher quality, larger (~3.0GB for 3.8B model)
      Q8_0   — Near-full quality, largest (~3.9GB for 3.8B model)
      F16    — Full float16, no quantization (~7GB for 3.8B model)
    """

    logger.info("=" * 60)
    logger.info("Step 2: Converting to GGUF format")
    logger.info(f"  Source:         {merged_dir}")
    logger.info(f"  Output dir:     {gguf_dir}")
    logger.info(f"  Quantization:   {quantization}")
    logger.info("=" * 60)

    Path(gguf_dir).mkdir(parents=True, exist_ok=True)

    # Find llama.cpp convert script
    if llama_cpp_path:
        convert_script = Path(llama_cpp_path) / "convert_hf_to_gguf.py"
    else:
        # Try common locations
        search_paths = [
            Path("./llama.cpp/convert_hf_to_gguf.py"),
            Path("../llama.cpp/convert_hf_to_gguf.py"),
            Path(os.path.expanduser("~/llama.cpp/convert_hf_to_gguf.py")),
        ]
        convert_script = None
        for p in search_paths:
            if p.exists():
                convert_script = p
                break

    if convert_script is None or not convert_script.exists():
        logger.error(
            "llama.cpp convert_hf_to_gguf.py not found.\n"
            "Install llama.cpp:\n"
            "  git clone https://github.com/ggerganov/llama.cpp\n"
            "  cd llama.cpp && pip install -r requirements.txt\n"
            "Then re-run with: --llama_cpp_path ./llama.cpp"
        )
        sys.exit(1)

    # Step 2a: Convert to float16 GGUF
    f16_gguf = Path(gguf_dir) / "fixit-slm-f16.gguf"
    logger.info(f"Converting to F16 GGUF: {f16_gguf}")

    subprocess.run([
        sys.executable,
        str(convert_script),
        merged_dir,
        "--outfile", str(f16_gguf),
        "--outtype", "f16",
    ], check=True)

    # Step 2b: Quantize to target format
    quantized_gguf = Path(gguf_dir) / f"fixit-slm-{quantization}.gguf"
    logger.info(f"Quantizing to {quantization}: {quantized_gguf}")

    # Find llama-quantize binary
    quantize_bin = Path(llama_cpp_path or "./llama.cpp") / "llama-quantize"
    if not quantize_bin.exists():
        quantize_bin = Path(llama_cpp_path or "./llama.cpp") / "quantize"  # older name

    if not quantize_bin.exists():
        logger.error(
            "llama-quantize binary not found. Build llama.cpp first:\n"
            "  cd llama.cpp && cmake -B build && cmake --build build --config Release"
        )
        sys.exit(1)

    subprocess.run([
        str(quantize_bin),
        str(f16_gguf),
        str(quantized_gguf),
        quantization,
    ], check=True)

    # Clean up intermediate F16 file
    f16_gguf.unlink()
    logger.info(f"GGUF export complete: {quantized_gguf}")

    return str(quantized_gguf)


# ─────────────────────────────────────────────────────────────────────────────
# Step 3: Create Ollama Modelfile
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are FIXIT SLM, an ultra-practical assistant designed to help people understand, build, repair, troubleshoot, and improve things in the real world.

Your purpose is not merely to answer questions. Your purpose is to make users capable.

You always structure your responses using the following labeled sections:

**What is happening?** — Explain the situation clearly.
**Why is it happening?** — Explain the root causes.
**Real-life example** — Give a realistic, relatable scenario.
**How professionals approach it** — Explain expert thinking and methodology.
**Step-by-step solution** — Provide numbered, actionable steps.
**Common mistakes** — List the errors most people make.
**How to verify success** — Explain how to confirm the fix worked.

Every response must answer: What? Why? How? What if it fails? How do I know it worked?

Use clear language, short paragraphs, and bullet points. Avoid jargon and academic fluff. Never skip sections."""


def create_modelfile(gguf_path: str, output_path: str = "./Modelfile") -> None:
    """Generate the Ollama Modelfile for local serving."""

    modelfile_content = f"""# FIXIT SLM — Ollama Modelfile
# Generated by merge_model.py
# Usage: ollama create fixit-slm -f ./Modelfile

FROM {gguf_path}

SYSTEM \"\"\"{SYSTEM_PROMPT}\"\"\"

# Generation parameters
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER top_k 40
PARAMETER num_predict 1024
PARAMETER stop "<|end|>"
PARAMETER stop "<|user|>"
PARAMETER stop "<|system|>"

# Context window
PARAMETER num_ctx 4096
"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(modelfile_content)

    logger.info(f"Modelfile written to: {output_path}")
    logger.info("\nTo create the Ollama model, run:")
    logger.info(f"  ollama create fixit-slm -f {output_path}")
    logger.info("\nTo test the model:")
    logger.info('  ollama run fixit-slm "My laptop fan runs at full speed even when idle."')


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(description="FIXIT SLM — Merge LoRA + Export GGUF")
    parser.add_argument(
        "--lora_path", required=True,
        help="Path to LoRA adapter directory (output of train.py)"
    )
    parser.add_argument(
        "--base_model", default="microsoft/Phi-3-mini-4k-instruct",
        help="Base model name (must match what was used in training)"
    )
    parser.add_argument(
        "--output_dir", default="./merged",
        help="Directory to save merged full model"
    )
    parser.add_argument(
        "--gguf_dir", default="./gguf",
        help="Directory to save GGUF files"
    )
    parser.add_argument(
        "--quantization", default="Q4_K_M",
        choices=["Q2_K", "Q4_K_M", "Q5_K_M", "Q8_0", "F16"],
        help="GGUF quantization level (Q4_K_M recommended for 6GB VRAM)"
    )
    parser.add_argument(
        "--llama_cpp_path", default=None,
        help="Path to llama.cpp directory (auto-detected if not specified)"
    )
    parser.add_argument(
        "--modelfile_output", default="./Modelfile",
        help="Where to write the Ollama Modelfile"
    )
    parser.add_argument(
        "--skip_merge", action="store_true",
        help="Skip merge step (use if merged model already exists)"
    )
    parser.add_argument(
        "--skip_gguf", action="store_true",
        help="Skip GGUF conversion (useful if only updating the Modelfile)"
    )
    parser.add_argument(
        "--use_gcs", action="store_true", default=False,
        help="[GCP Placeholder] Use GCS for inputs and outputs"
    )
    return parser.parse_args()


# Fix missing import
from typing import Optional


def main():
    args = parse_args()

    # Step 1: Merge LoRA
    if not args.skip_merge:
        lora_path = args.lora_path
        if args.use_gcs and lora_path.startswith("gs://"):
            local_lora = "/tmp/fixit-lora-final"
            sync_from_gcs(lora_path, local_lora)
            lora_path = local_lora

        merge_lora(
            base_model_name=args.base_model,
            lora_path=lora_path,
            output_dir=args.output_dir,
        )

        if args.use_gcs:
            gcs_merged = f"gs://fixit-slm-artifacts/merged/"
            sync_to_gcs(args.output_dir, gcs_merged)
    else:
        logger.info("Skipping merge step (--skip_merge specified)")

    # Step 2: Convert to GGUF
    gguf_path = None
    if not args.skip_gguf:
        gguf_path = convert_to_gguf(
            merged_dir=args.output_dir,
            gguf_dir=args.gguf_dir,
            quantization=args.quantization,
            llama_cpp_path=args.llama_cpp_path,
        )

        if args.use_gcs:
            gcs_gguf = f"gs://fixit-slm-artifacts/gguf/"
            sync_to_gcs(args.gguf_dir, gcs_gguf)
    else:
        logger.info("Skipping GGUF conversion (--skip_gguf specified)")
        # Use expected path
        gguf_path = str(Path(args.gguf_dir) / f"fixit-slm-{args.quantization}.gguf")

    # Step 3: Create Ollama Modelfile
    if gguf_path:
        create_modelfile(
            gguf_path=gguf_path,
            output_path=args.modelfile_output,
        )

    logger.info("\nPipeline complete. Model is ready for Ollama serving.")


if __name__ == "__main__":
    main()
