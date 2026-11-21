# FIXIT SLM

**A small language model that explains how to fix things, and runs entirely on your machine.**

FIXIT is Microsoft's Phi-3 Mini, fine-tuned with QLoRA to troubleshoot hardware and software problems the way a good technician teaches. Every answer follows the same structure:

1. **What is happening?** The symptoms.
2. **Why is it happening?** The root causes.
3. **Real-life example.** An analogy that makes it click.
4. **How professionals approach it.** The method, step by step.
5. **How to verify the fix.**

It serves through [Ollama](https://ollama.com) with a local Next.js chat UI. No API keys, no network calls, no data leaving the device.

https://github.com/kanaktronics/FixIT-SLM/raw/main/FIXIT_SLM_Deployment_Guide.mp4

---

## Two ways to run it

**1. Try the behaviour now (no training).** `web/Modelfile_Local` puts the FIXIT system prompt on top of the stock `phi3` model. It's the quickest way to see the response format, but it is **not** the fine-tuned model.

```bash
ollama pull phi3
cd web
ollama create fixit-slm -f Modelfile_Local
npm install && npm run dev        # http://localhost:3000
```

**2. Train the real thing.** The full pipeline is in `training/`:

```
generate_dataset.py ─▶ expand_dataset.py ─▶ train.py ─▶ merge_model.py ─▶ Modelfile
   seed examples         grow it with          QLoRA on      merge adapter,     serve with
                         Gemini (optional)     a T4 GPU      convert to GGUF    Ollama
```

```bash
cd training
pip install -r requirements.txt
python generate_dataset.py --output dataset/fixit_train.jsonl
python train.py --dataset dataset/fixit_train.jsonl
git clone https://github.com/ggml-org/llama.cpp          # used only for GGUF conversion
python merge_model.py --lora_path ./checkpoints/fixit-lora-final --output_dir ./merged \
  --gguf_dir ./gguf --quantization Q4_K_M --llama_cpp_path ./llama.cpp
ollama create fixit-slm -f Modelfile
```

`training/gcp/` has a Vertex AI custom-training config: one T4, `n1-standard-8`, about $0.35 an hour for the GPU. It also has a Cloud Build file and a script to upload to GCS.

## Training setup (`training/train.py`)

| | |
| :-- | :-- |
| Base model | `microsoft/Phi-3-mini-4k-instruct` (3.8B) |
| Method | QLoRA: 4-bit NF4 with double quantisation, bf16 compute |
| LoRA | rank 16, alpha 32, dropout 0.05, applied to all attention and MLP projections |
| Schedule | 3 epochs, learning rate 2e-4 with cosine decay, batch size 2, max length 1,024 tokens |
| Validation | 5% held out |
| Format | ChatML JSONL: system, user, assistant |

QLoRA is what makes a 3.8B model trainable on a single 16 GB T4. The base weights stay frozen in 4-bit, and only the adapter is trained.

## Where the dataset stands

`dataset/fixit_train.jsonl` has 99 examples:
- **23 are hand-written**, across six modes: troubleshoot, learn, build, engineering, decision, reality check.
- **76 are template placeholders** that `generate_dataset.py` produces to reach the target count. The script itself marks them to be replaced.

`expand_dataset.py` uses Gemini to write realistic scenarios across 9 trade and engineering domains, aiming for 2,000 examples. That expansion, followed by an evaluation set, is the next step before the fine-tune is worth publishing.

## Layout

```
training/   dataset generation, QLoRA training, merge and GGUF export, Vertex AI config
web/        Next.js chat UI that talks to Ollama on localhost:11434
```

MIT licensed. The base Phi-3 model is under Microsoft's licence.

Built by [Kanak Raj](https://github.com/kanaktronics), founder of [Avenoric](https://avenoric.tech).
