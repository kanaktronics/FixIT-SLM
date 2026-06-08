# 🛠️ FIXIT SLM 
**An Ultra-Practical Hardware & Software Diagnostic AI Model**  
*Built by Kanak Raj (Founder, [ExplainMate.tech](https://explainmate.app))*

---

## 🚀 Overview

**FIXIT SLM** is a fine-tuned Small Language Model (SLM) based on Microsoft's `phi-3` architecture. It is strictly engineered to act as an expert technical troubleshooter. 

Unlike generic conversational AIs, FIXIT SLM is bound by a custom master persona designed to **"explain, not just deliver."** It breaks down complex technical failures using real-world analogies, professional workflows, and actionable step-by-step solutions.

This repository contains the complete end-to-end stack for FIXIT SLM:
- **`training/`**: The PyTorch/LoRA fine-tuning scripts and dataset used to train the adapter weights.
- **`web/`**: A premium, offline-first Next.js React application (Black & Amber frosted glass UI) that serves the model locally.
- **Ollama Integration**: Baked-in custom Modelfiles for running the AI 100% offline via local inference.

---

## 📺 Deployment Guide

Watch the official deployment and setup guide:

<video src="./FIXIT_SLM_Deployment_Guide.mp4" controls="controls" muted="muted" class="d-block rounded-bottom-2 border-top width-fit" style="max-height:640px; min-height: 200px">
  Your browser does not support the video tag.
</video>

---

## ⚙️ Quick Start (Local Inference)

1. **Install Ollama**
   Make sure you have [Ollama](https://ollama.com/) installed locally.
   
2. **Bake the Model**
   Run the following command to inject the custom FIXIT system prompt into the model architecture:
   ```bash
   cd web
   ollama create fixit-slm -f Modelfile_Local
   ```

3. **Start the Interface**
   Launch the premium Next.js UI to interact with the model:
   ```bash
   cd web
   npm install
   npm run dev
   ```
   Open `http://localhost:3000` in your browser. The status dot will turn **Amber** when the model is successfully connected.

---

## 🧠 The "ExplainMate" Philosophy

This model is a technical extension of the core mission at **K&D Labs / ExplainMate**. 
Every response from FIXIT SLM is structurally forced to answer:
- **What is happening?** (The symptoms)
- **Why is it happening?** (Root causes)
- **Real-life example** (An analogy to build deep understanding)
- **Step-by-step solution** (Professional methodology)
- **How to verify success** (Testing the fix)

---

## 📄 License
This project is open-sourced under the MIT License. The base `phi-3` model is subject to Microsoft's original licensing.
