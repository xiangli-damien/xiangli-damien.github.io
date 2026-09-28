---
title: Reading List
summary: Curated and gradually updated reading list.
date: 2025-03-09
category: reading
tags: [reading, papers, research]
lang: en
cover: ../../../assets/figures/readinglist.jpg
coverAlt: Reading list
readingMinutes: 20
---

## 1. Foundation Models

How to build models: architecture, pretraining, scaling, and multimodal extensions.

### 1.1 Architecture & Pretraining

- (2017, Jun) _Attention Is All You Need_ — Vaswani et al. [arXiv](https://arxiv.org/abs/1706.03762)  
    The Transformer. Self-attention replaces recurrence; the blueprint for everything that follows.
    
- (2023, Mar) _GPT-4 Technical Report_ — OpenAI [arXiv](https://arxiv.org/abs/2303.08774)  
    System-level capabilities report; sets the RLHF-era performance bar.
    
- (2023, Feb) _LLaMA: Open and Efficient Foundation Language Models_ — Touvron et al. [arXiv](https://arxiv.org/abs/2302.13971)  
    Smaller, well-trained open models rival much larger ones; backbone of open-source LLM research.
    
- (2023, Sep) _Qwen Technical Report_ — Bai et al. [arXiv](https://arxiv.org/abs/2309.16609)  
    Qwen family overview; one of our primary experimental models.
    
- (2024, May) _DeepSeek-V2_ — Liu et al. [arXiv](https://arxiv.org/abs/2405.04434)  
    MoE with Multi-head Latent Attention; strong efficiency–performance tradeoff.
    

### 1.2 Scaling & Emergent Abilities

- (2020, Jan) _Scaling Laws for Neural Language Models_ — Kaplan et al. [arXiv](https://arxiv.org/abs/2001.08361)  
    Power-law relationships between compute/data/parameters and loss; foundational scaling reference.
    
- (2022, Mar) _Training Compute-Optimal Large Language Models (Chinchilla)_ — Hoffmann et al. [arXiv](https://arxiv.org/abs/2203.15556)  
    Optimal allocation of compute budget between model size and data; most LLMs were undertrained on data.
    
- (2022, Jun) _Emergent Abilities of Large Language Models_ — Wei et al. [arXiv](https://arxiv.org/abs/2206.07682)  
    Abilities appear abruptly with scale; context for why ICL/CoT only work above certain sizes.
    

### 1.3 Training Theory

- (2019, Jun) *Understanding Generalization through Visualizations* — Li et al. [arXiv](https://arxiv.org/abs/1906.03291)  
	Loss landscape visualization reveals flat vs. sharp minima; geometric perspective on why certain training setups generalize better.
	
- (2021, Sep) _Stochastic Training Is Not Necessary for Generalization_ — Geiping et al. [arXiv](https://arxiv.org/abs/2109.14119)  
    Full-batch + explicit regularization matches SGD generalization; challenges implicit regularization narrative.
    
### 1.4 Vision-Language Architectures

VLMs are foundation models whose research question is still "how to build."

**Surveys**

- (2024, May) _An Introduction to Vision-Language Modeling_ — Bordes et al. [arXiv](https://arxiv.org/abs/2405.17247)  
    Tutorial-style overview: taxonomy, training recipes, evaluation, video extensions.
    
- _A Dive into Vision-Language Models_ — HuggingFace [Blog](https://huggingface.co/blog/vlms-101)  
    Accessible blog walkthrough of VLM concepts and design choices.
    
- _Awesome Vision-Language Fine-tune_ — [GitHub](https://github.com/Hodasia/Awesome-Vision-Language-Finetune)  
    Curated repo of VLM-related works and resources.
    

**Contrastive Alignment**

- (2021, Mar) _Learning Transferable Visual Models From Natural Language Supervision (CLIP)_ — Radford et al. [arXiv](https://arxiv.org/abs/2103.00020)  
    Contrastive image-text pretraining; zero-shot transfer paradigm underpinning most VLM work.

**Bridging Architectures**

- (2022, Apr) _Flamingo: a Visual Language Model for Few-Shot Learning_ — Alayrac et al. [arXiv](https://arxiv.org/abs/2204.14198)  
    Frozen backbones + cross-attention gating; pioneered multimodal few-shot ICL.
    
- (2022, Jan) _BLIP: Bootstrapping Language-Image Pre-training_ — Li et al. [arXiv](https://arxiv.org/abs/2201.12086)  
    Captioner + filter bootstrap; unifies understanding and generation.
    
- (2023, Jan) _BLIP-2_ — Li et al. [arXiv](https://arxiv.org/abs/2301.12597)  
    Q-Former bridges frozen vision encoder and frozen LLM; dramatically reduces training cost.
    

**Instruction-Tuned VLMs**

- (2023, Apr) _Visual Instruction Tuning (LLaVA)_ — Liu et al. [arXiv](https://arxiv.org/abs/2304.08485) · [Project](https://llava-vl.github.io/)  
    GPT-4-generated multimodal instruction data; open-source multimodal assistant paradigm.
    
- (2023, Oct) _Improved Baselines with Visual Instruction Tuning (LLaVA-1.5)_ — Liu et al. [arXiv](https://arxiv.org/abs/2310.03744)  
    Design choice ablation; stronger and more reproducible baselines.
    
- (2024) _LLaVA-NeXT Series_ — [NeXT](https://llava-vl.github.io/blog/2024-01-30-llava-next/) · [Video](https://llava-vl.github.io/blog/2024-04-30-llava-next-video/) · [Interleave](https://arxiv.org/abs/2407.07895)  
    Higher resolution, multi-image, video, 3D extensions.
    
- (2023, Aug) _Qwen-VL_ — Bai et al. [arXiv](https://arxiv.org/abs/2308.12966)  
    Multi-task VLM with grounding, OCR, dialogue.
    
- (2024, Sep) _Qwen2-VL_ — Wang et al. [arXiv](https://arxiv.org/abs/2409.12191)  
    Dynamic resolution; enhanced perception at arbitrary resolutions.
    
- (2025, Feb) _Qwen2.5-VL Technical Report_ [arXiv](https://arxiv.org/abs/2502.13923)  
    Latest in the Qwen-VL series.
    
- (2024, Oct) _Janus_ — DeepSeek [arXiv](https://arxiv.org/abs/2410.13848)  
    Decoupled visual encoders for understanding vs. generation.
    
- (2025, Jan) _Janus-Pro_ — DeepSeek [arXiv](https://arxiv.org/abs/2501.17811)  
    Improved Janus with stronger generation quality.
    

**Prompt Learning for VLMs**

- (2021, Sep) _CPT: Colorful Prompt Tuning_ — Yao et al. [arXiv](https://arxiv.org/abs/2109.11797)  
    Cross-modal prompt tuning for VLMs.
    
- (2022, Oct) _Unified Vision and Language Prompt Learning_ — Zang et al. [arXiv](https://arxiv.org/abs/2210.07225)  
    Joint visual + textual prompt optimization; addresses single-modality instability.
    
- (2023, Apr) _Towards Robust Prompts on Vision-Language Models_ — Gu et al. [arXiv](https://arxiv.org/abs/2304.08479)  
    OOD robustness of VLM prompt learning.
    

### 1.5 Alternative Architectures

Departures from dense autoregressive Transformers: MoE, linear-time models, and hybrid designs.

- (2022, Jan) _Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity_ — Fedus et al. [arXiv](https://arxiv.org/abs/2101.03961)  
    Sparse MoE routing; one expert per token scales parameters cheaply. Foundational MoE reference.
    
- (2023, May) _RWKV: Reinventing RNNs for the Transformer Era_ — Peng et al. [arXiv](https://arxiv.org/abs/2305.13048)  
    Linear-complexity RNN with Transformer-level performance; recurrent alternative for long-context.
    
- (2023, Dec) _Mamba: Linear-Time Sequence Modeling with Selective State Spaces_ — Gu & Dao [arXiv](https://arxiv.org/abs/2312.00752)  
    Selective state-space model; linear-time inference with strong language modeling results.
    
- (2025, Jan) _MiniMax-01: Scaling Foundation Models with Lightning Attention_ — MiniMax [arXiv](https://arxiv.org/abs/2501.08313)  
    Lightning attention for efficient long-context scaling.
    

---

## 2. Post-training & Alignment

How to align models to human intent: RLHF, preference optimization, instruction tuning, parameter-efficient adaptation, and safety. Papers marked ★ are recommended additions — this is an important gap to fill since every model we analyze has gone through this pipeline.

### 2.1 RLHF & Preference Optimization

- ★ (2022, Mar) _Training Language Models to Follow Instructions with Human Feedback (InstructGPT)_ — Ouyang et al. [arXiv](https://arxiv.org/abs/2203.02155)  
    THE RLHF paper: SFT → reward model → PPO. Defines the modern alignment pipeline.
    
- ★ (2023, May) _Direct Preference Optimization (DPO)_ — Rafailov et al. [arXiv](https://arxiv.org/abs/2305.18290)  
    Bypasses explicit reward model; directly optimizes policy from preference pairs. Simpler and increasingly dominant over PPO.
    
- ★ (2022, Dec) _Constitutional AI: Harmlessness from AI Feedback_ — Bai et al. [arXiv](https://arxiv.org/abs/2212.08073)  
    AI self-critique guided by principles; reduces reliance on human red-teaming.
    
- ★ (2024, May) _RLHF Workflow: From Reward Modeling to Online RLHF_ — Dong et al. [arXiv](https://arxiv.org/abs/2405.07863)  
    Practical tutorial on the full pipeline; good single-reference entry point.- 

### 2.2 Safety & Red-Teaming

- ★ (2022, Sep) _Red Teaming Language Models to Reduce Harms_ — Perez et al. [arXiv](https://arxiv.org/abs/2209.07858)  
    Systematic red-teaming methodology; context for our JailbreakBench safety analysis.
    
- ★ (2023, Jul) _Universal and Transferable Adversarial Attacks on Aligned Language Models (GCG)_ — Zou et al. [arXiv](https://arxiv.org/abs/2307.15043)  
    Gradient-based adversarial suffix attack; key baseline for jailbreak research.
    

### 2.3 Parameter-Efficient Fine-tuning (PEFT)

Adapting pretrained models with minimal parameter updates; background for understanding post-trained models we analyze.

- (2021, Jan) _Prefix-Tuning: Optimizing Continuous Prompts for Generation_ — Li & Liang [arXiv](https://arxiv.org/abs/2101.00190)  
    Learnable prefix vectors prepended to keys/values; freezes all LM parameters.
    
- (2021, Jun) _LoRA: Low-Rank Adaptation of Large Language Models_ — Hu et al. [arXiv](https://arxiv.org/abs/2106.09685)  
    Low-rank weight update matrices; dominant PEFT method. Used extensively in R1 reproduction and fine-tuning experiments.
    
- (2023, May) _QLoRA: Efficient Finetuning of Quantized LLMs_ — Dettmers et al. [arXiv](https://arxiv.org/abs/2305.14314)  
    4-bit quantized base + LoRA adapters; enables fine-tuning 65B models on a single GPU.
    

### 2.4 Instruction Tuning

- ★ (2021, Sep) _Finetuned Language Models Are Zero-Shot Learners (FLAN)_ — Wei et al. [arXiv](https://arxiv.org/abs/2109.01652)  
    Instruction tuning on diverse NLP tasks enables zero-shot generalization; foundational instruction tuning paper.
    
- ★ (2022, Oct) _Scaling Instruction-Finetuned Language Models (Flan-T5/PaLM)_ — Chung et al. [arXiv](https://arxiv.org/abs/2210.11416)  
    Scaling instruction tuning to 1.8K tasks; shows continued improvement with more tasks and model scale.
    
- ★ (2022, Dec) _Self-Instruct: Aligning Language Models with Self-Generated Instructions_ — Wang et al. [arXiv](https://arxiv.org/abs/2212.10560)  
    Bootstrap instruction data from the model itself; reduces reliance on human annotation.
    

---

## 3. Inference: Prompting, Reasoning & Tools

How to use models without weight updates: demonstrations, reasoning chains, code generation, tool calls, multimodal prompting, retrieval, agents, and test-time scaling.

### 3.1 ICL Foundations & Mechanisms

- _Stanford AI Blog — Understanding In-Context Learning_ [Blog](https://ai.stanford.edu/blog/understanding-incontext/)  
    Introductory blog; shared vocabulary on ICL phenomena.
    
- (2022, Feb) _Rethinking the Role of Demonstrations: What Makes In-Context Learning Work?_ — Min et al. [arXiv](https://arxiv.org/abs/2202.12837)  
    Random labels can still work; ICL driven by structural/distributional cues beyond label correctness.
    
- (2023, Sep) _Ambiguity-Aware In-Context Learning with Large Language Models_ [arXiv](https://arxiv.org/abs/2309.07900)  
    Selects demos near decision boundaries; pure prompt construction at inference time, no retraining.
    
- (2023, May) _Label Words are Anchors: An Information Flow Perspective for Understanding ICL_ — Wang et al. [arXiv](https://arxiv.org/abs/2305.14160)  
    EMNLP 2023 Best Paper. Label tokens as "anchors" aggregating semantic info in shallow layers then propagating to predictions.
    
- (2023, May) _Symbol Tuning Improves In-Context Learning_ — Wei et al. [arXiv](https://arxiv.org/abs/2305.08298)  
    Arbitrary symbol labels during finetuning → model follows in-context mappings over prior knowledge.
    

### 3.2 Reasoning-Augmented Prompting

- (2022, Jan) _Chain-of-Thought Prompting Elicits Reasoning in Large Language Models_ — Wei et al. [arXiv](https://arxiv.org/abs/2201.11903)  
    Intermediate reasoning steps dramatically improve multi-step reasoning. The CoT origin paper.
    
- (2022, Mar) _Self-Consistency Improves Chain of Thought Reasoning_ — Wang et al. [arXiv](https://arxiv.org/abs/2203.11171)  
    Multiple reasoning paths + majority vote; trades diversity for accuracy, simple and very effective.
    
- (2023, May) _Tree of Thoughts: Deliberate Problem Solving with Large Language Models_ — Yao et al. [arXiv](https://arxiv.org/abs/2305.10601)  
    Explicit tree-structured search over reasoning steps with lookahead and backtracking.
    
- (2024, Feb) _Self-Discover: Large Language Models Self-Compose Reasoning Structures_ — Zhou et al. [arXiv](https://arxiv.org/abs/2402.03620)  
    Model self-selects and composes reasoning modules into explicit structure before solving.
    
- (2022, Oct) _Recitation-Augmented Language Models_ — Sun et al. [arXiv](https://arxiv.org/abs/2210.01296)  
    Model "recites" relevant passages from parametric memory first, then answers.
    
- (2023, Oct) _Large Language Models can Learn Rules_ — Zhu et al. [arXiv](https://arxiv.org/abs/2310.07064)  
    HtT: induce rule library from examples, then apply rules for deduction; bridges ICL and symbolic reasoning.
    
- (2022, Sep) _Compositional Semantic Parsing with Large Language Models_ — Drozdov et al. [arXiv](https://arxiv.org/abs/2209.15003)  
    Decomposition-based prompting (least-to-most) for compositional generalization.
    

### 3.3 Code, Symbolic & Tool Use

- (2022, Apr) _InCoder: A Generative Model for Code Infilling and Synthesis_ — Fried et al. [arXiv](https://arxiv.org/abs/2204.05999)  
    Bidirectional code infilling + generation; how context windows organize code information.
    
- (2022, Dec) _Dialog2API: Task-Oriented Dialogue with API Description and Example Programs_ — Shu et al. [arXiv](https://arxiv.org/abs/2212.09946)  
    Generates and executes API calls using documentation + example programs as context.
    
- (2023, Feb) _Toolformer: Language Models Can Teach Themselves to Use Tools_ — Schick et al. [arXiv](https://arxiv.org/abs/2302.04761)  
    Self-supervised tool-use learning; canonical bootstrapped tool-use paper.
    
- (2023, Jul) _ToolLLM: Facilitating Large Language Models to Master 16000+ Real-world APIs_ — Qin et al. [arXiv](https://arxiv.org/abs/2307.16789)  
    ToolBench + ToolEval for systematic large-scale API mastery.
    
- (2022, Oct) _Binding Language Models in Symbolic Languages (Binder)_ — Cheng et al. [arXiv](https://arxiv.org/abs/2210.02875)  
    Binds LM into executable programs (SQL/Python); training-free, few-shot, debuggable.
    
- (2023, May) _ToolkenGPT_ — Hao et al. [arXiv](https://arxiv.org/abs/2305.11554)  
    Tools as special tokens with learned embeddings; bypasses context-length bottleneck.
    
- (2023, May) _Grammar Prompting for Domain-Specific Language Generation_ — Wang et al. [arXiv](https://arxiv.org/abs/2305.19234)  
    DSL grammar (BNF) in prompt; model predicts grammar then generates conforming output.
    
- (2024, Jan) _ReGAL: Refactoring Programs to Discover Generalizable Abstractions_ — Stengel-Eskin et al. [arXiv](https://arxiv.org/abs/2401.16467)  
    Gradient-free refactoring → reusable function libraries.
    
- (2024, Jan) _TroVE: Inducing Verifiable and Efficient Toolboxes_ — Wang et al. [arXiv](https://arxiv.org/abs/2401.12869)  
    Verifiable, prunable function toolboxes for programmatic tasks.
    
- (2022, Dec) _CoCoMIC: Code Completion By Jointly Modeling In-file and Cross-file Context_ — Ding et al. [arXiv](https://arxiv.org/abs/2212.10007)  
    Cross-file retrieval for code completion.
    

### 3.4 Multimodal Prompting

Multimodal ICL is still "how to use models" — same research question, different modality.

- (2023, Nov) _Compositional Chain-of-Thought Prompting for Large Multimodal Models_ — Mitra et al. [arXiv](https://arxiv.org/abs/2311.17076)  
    Scene graph as intermediate CoT for compositional multimodal reasoning; no finetuning needed.
    
- (2024) _Visual Chain-of-Thought Prompting for Knowledge-Based Visual Reasoning_ — Chen et al. [AAAI](https://ojs.aaai.org/index.php/AAAI/article/view/27888)  
    Iterative "see-think-confirm" chain with retrieval/evidence integration.
    
- (2024, Feb) _PIVOT: Iterative Visual Prompting Elicits Actionable Knowledge for VLMs_ — Nasiriany et al. [arXiv](https://arxiv.org/abs/2402.07872)  
    Discretizes action space into visual proposals; VLM iteratively selects and refines.
    
- (2023, Oct) _Set-of-Mark Prompting Unleashes Extraordinary Visual Grounding in GPT-4V_ — Yang et al. [arXiv](https://arxiv.org/abs/2310.11441)  
    Segmentation-derived marks on images → explicit referrable regions for VLMs.
    
- (2023, Dec) _Visual Program Distillation_ — Hu et al. [arXiv](https://arxiv.org/abs/2312.03052)  
    LLM programs calling visual tools → verified traces → distilled into single VLM.
    
- (2023, Feb) _Re-ViLM: Retrieval-Augmented Visual Language Model_ — Yang et al. [arXiv](https://arxiv.org/abs/2302.04858)  
    Retrieval augmentation on Flamingo-style architectures; improves OOD captioning.
    
- (2023, Jun) _Meta-Personalizing Vision-Language Models to Find Named Instances in Video_ — Yeh et al. [arXiv](https://arxiv.org/abs/2306.10169)  
    Test-time vocabulary expansion for retrieving specific named instances in video.
    

### 3.5 Retrieval-Augmented Generation (RAG)

Augmenting LLMs with external retrieval at inference time.

- (2020, Apr) _Dense Passage Retrieval for Open-Domain Question Answering (DPR)_ — Karpukhin et al. [arXiv](https://arxiv.org/abs/2004.04906)  
    Dual-encoder dense retrieval replacing sparse methods; foundational retriever for RAG pipelines.
    
- (2020, May) _Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks (RAG)_ — Lewis et al. [arXiv](https://arxiv.org/abs/2005.11401)  
    The original RAG paper; jointly retrieves and generates. Defines the paradigm.
    
- (2021, Dec) _Improving Language Models by Retrieving from Trillions of Tokens (RETRO)_ — Borgeaud et al. [arXiv](https://arxiv.org/abs/2112.04426)  
    Chunked cross-attention retrieval at scale; retrieval integrated into pretraining.
    
- (2023, Oct) _Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection_ — Asai et al. [arXiv](https://arxiv.org/abs/2310.11511)  
    Model decides when to retrieve and self-critiques retrieved content; adaptive retrieval.
    

### 3.6 Agents

LLMs as autonomous decision-making agents with environment interaction.

- (2022, Oct) _ReAct: Synergizing Reasoning and Acting in Language Models_ — Yao et al. [arXiv](https://arxiv.org/abs/2210.03629)  
    Interleaves chain-of-thought reasoning with environment actions; foundational agent prompting framework.
    
- (2023, Mar) _Reflexion: Language Agents with Verbal Reinforcement Learning_ — Shinn et al. [arXiv](https://arxiv.org/abs/2303.11366)  
    Agent self-reflects on failures in natural language to improve on subsequent trials.
    
- (2023, Jul) _WebArena: A Realistic Web Environment for Building Autonomous Agents_ — Zhou et al. [arXiv](https://arxiv.org/abs/2307.13854)  
    Realistic web benchmark with self-hosted websites; standard agent evaluation environment.
    
- (2023, Oct) _SWE-bench: Can Language Models Resolve Real-World GitHub Issues?_ — Jimenez et al. [arXiv](https://arxiv.org/abs/2310.06770)  
    Real GitHub issue resolution benchmark; canonical coding agent evaluation.
    

### 3.7 Test-time Reasoning & Scaling

Scaling compute at inference time through extended reasoning, search, and verification — the post-o1/R1 paradigm. 

**Foundations**

- (2021, Dec) _Show Your Work: Scratchpads for Intermediate Computation with Language Models_ — Nye et al. [arXiv](https://arxiv.org/abs/2112.00114)  
    Scratchpad traces for multi-step computation; early precursor to long CoT reasoning.
    
- (2022, Mar) _STaR: Bootstrapping Reasoning With Reasoning_ — Zelikman et al. [arXiv](https://arxiv.org/abs/2203.14465)  
    Iterative self-improvement: generate rationales, filter by correctness, fine-tune. Bootstrap loop for reasoning.
    
- (2023, May) _Let's Verify Step by Step_ — Lightman et al. [arXiv](https://arxiv.org/abs/2305.20050)  
    Process reward models (PRMs) outperform outcome reward models; step-level supervision for math reasoning.
    
- (2023, Dec) _Math-Shepherd: Verify and Reinforce LLMs Step-by-step without Human Annotations_ — Wang et al. [arXiv](https://arxiv.org/abs/2312.08935)  
    Automatic process reward labeling via completion-based verification; scalable PRM training.
    
- (2024, Mar) _Quiet-STaR: Language Models Can Teach Themselves to Think Before Speaking_ — Zelikman et al. [arXiv](https://arxiv.org/abs/2403.09629)  
    Train model to generate internal rationale before every token; implicit chain-of-thought.
    

**Scaling & Frontier Systems**

- (2024, Feb) _DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models_ — Shao et al. [arXiv](https://arxiv.org/abs/2402.03300)  
    GRPO algorithm for math reasoning; direct predecessor to DeepSeek-R1's RL approach.
    
- (2024, Aug) _Scaling LLM Test-Time Compute Optimally can be More Effective than Scaling Model Parameters_ — Snell et al. [arXiv](https://arxiv.org/abs/2408.03314)  
    Systematic study of test-time compute scaling: Best-of-N, beam search, PRM-guided search. Foundational reference.
    
- (2024, Aug) _Inference Scaling Laws: An Empirical Analysis of Compute-Optimal Inference_ — Sardana et al. [arXiv](https://arxiv.org/abs/2408.00724)  
    Empirical scaling laws for inference-time compute allocation.
    
- (2025, Jan) _DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning_ — DeepSeek [arXiv](https://arxiv.org/abs/2501.12948)  
    Pure RL (GRPO) on base model yields emergent long CoT with self-verification. The paper that launched the post-R1 wave. **Key model for our trajectory/geometry analysis.**
    
- (2025, Jan) _s1: Simple Test-Time Scaling_ — Muennighoff et al. [arXiv](https://arxiv.org/abs/2501.19393)  
    1K curated datapoints + SFT + budget forcing ("Wait" token insertion); simple and effective test-time scaling.
    

**Improving & Controlling Long CoT**

- (2025, Feb) _LIMO: Less is More for Reasoning_ — Ye et al. [arXiv](https://arxiv.org/abs/2502.03387)  
    817 curated training samples achieve strong reasoning via SFT; challenges the need for massive data.
    
- (2025, Mar) _L1: Controlling How Long A Reasoning Model Thinks With Reinforcement Learning_ — Aggarwal et al. [arXiv](https://arxiv.org/abs/2503.04697)  
    RL with length-conditioned reward to control reasoning budget; efficiency without sacrificing accuracy.
    
- (2025, Feb) _TokenSkip: Controllable Chain-of-Thought Compression in LLMs_ — Xia et al. [arXiv](https://arxiv.org/abs/2502.12067)  
    Filter "unimportant" CoT tokens and fine-tune on compressed trajectories; reduces reasoning cost.
    
- (2025, Mar) _START: Self-taught Reasoner with Tools_ — Zhao et al.  
    Integrate tool usage (Python code execution) within reasoning traces; hint insertion + rejection sampling.
    
- (2025, May) _SEAL: Steerable Reasoning Calibration of Large Language Models for Free_ — Liu et al.  
    Categorizes reasoning steps (execution/reflecting/transition); steering vectors control reasoning step types for efficient inference. Connects to our representation steering work.
    

**R1 Reproduction & Open Efforts**

- (2025, Feb) _Simple Reinforcement Learning for Reasoning (SimpleRL)_ — Zeng et al. [GitHub](https://github.com/hkust-nlp/simpleRL-reason)  
    Rule-based reward + PPO on Qwen2.5-Math-7B base; surprisingly strong without SFT or reward models.
    
- (2025, Feb) _DeepScaleR_ — Luo et al. [Blog](https://pretty1.dev/blog/deepscaler)  
    Iterative context-length scaling (8K→16K→24K) with GRPO; curriculum learning insight for RL training.
    
- (2025, Feb) _Open R1_ — Hugging Face [GitHub](https://github.com/huggingface/open-r1)  
    Fully open reproduction of DeepSeek-R1; community reference implementation.
    

---

## 4. Interpretability & Representation Science

How to understand model internals. Covers the full spectrum from passive observation (probing, geometry) through feature decomposition (SAEs) to causal verification (circuits, patching) to applied intervention (steering). **This is the core area of our research.**

### 4.1 Probing & Readout

Reading hidden states through external projections or classifiers.

- (2020) _Interpreting GPT: the Logit Lens_ — nostalgebraist [LessWrong](https://www.lesswrong.com/posts/AcKRB8wDpdaN6v6ru/interpreting-gpt-the-logit-lens)  
    Intermediate residual stream → unembedding → vocabulary. Simple but anchored to output space.
    
- (2023, Mar) _Eliciting Latent Predictions with the Tuned Lens_ — Belrose et al. [arXiv](https://arxiv.org/abs/2303.08112)  
    Layer-wise affine translators improve logit lens; better depth-wise decoding.
    
- (2019, Jun) _A Structural Probe for Finding Syntax_ — Hewitt & Manning [arXiv](https://arxiv.org/abs/1906.02715)  
    Classic linear probe; foundational probing methodology reference.
    
- (2021, Feb) _Probing Classifiers: Promises, Shortcomings, and Advances_ — Belinkov [arXiv](https://arxiv.org/abs/2102.12452)  
    Meta-analysis of probing: what probes can/cannot tell, capacity confounds, best practices.
    
- (2023, Jul) _Overthinking the Truth: How LMs Process False Demonstrations_ — Halawi et al. [arXiv](https://arxiv.org/abs/2307.09476)  
    Misleading demos cause late-layer "overthinking"; relevant to ICL failure in internal representations.
    

### 4.2 Representation Geometry

Intrinsic geometric structure of hidden states — the theoretical core of our NDR and ClusterLens work.

- (2019, Sep) _How Contextual are Contextualized Word Representations?_ — Ethayarajh [arXiv](https://arxiv.org/abs/1909.00512)  
    Anisotropy in contextualized embeddings; representations occupy a narrow cone. Geometric baseline.
    
- (2023, Oct) _The Geometry of Truth: Emergent Linear Structure in LLM Representations_ — Marks & Tegmark [arXiv](https://arxiv.org/abs/2310.06824)  
    Truth values are linearly separable; supports linear representation hypothesis.
    
- (2023, Nov) _The Linear Representation Hypothesis and the Geometry of Large Language Models_ — Park et al. [arXiv](https://arxiv.org/abs/2311.03658)  
    When and why concepts are linearly encoded; theoretical grounding for probing and steering.
    
- (2023, Sep) _Emergent Linear Representations in World Models of Sequence Transformers_ — Nanda et al. [arXiv](https://arxiv.org/abs/2309.00941)  
    Linear representations emerge in Othello transformers; linear structure from computation, not just data.
    
- (2023, Feb) _Geometry of Intrinsic Dimension in Transformer Representations_ — Valeriani et al. [arXiv](https://arxiv.org/abs/2302.00294)  
    Intrinsic dimensionality across layers; phase-like transitions in representational complexity.
    
- (2024, May) _Transformers Represent Belief State Geometry in their Residual Stream_ — Shai et al. [arXiv](https://arxiv.org/abs/2405.16495)  
    Residual stream encodes belief/state geometry; bridges representation structure → behavior.
    
- (2025, Oct) _Chain-of-Embedding (CoE)_ — Wang et al. [arXiv](https://arxiv.org/abs/2410.13640)  
    Layer-wise hidden states as trajectory; angle/displacement → training-free correctness scores. **Directly related to our geometric self-evaluation (NDR, three-axis).**
    
- (2025) _Curved Geometry in Logit Space_ — Manson et al.  
    Non-linear geometric structure under logit-space coordinates; complements linear analyses.
    
- (2025) _Predictive Power from Representation Geometry_ — Li et al.  
    Collective geometric properties → predictive performance; closely related to ClusterLens.
    
- (2025) _Transformer Clustering Dynamics_ — Wu et al.  
    Group structure in Transformer representations under task/training dynamics.
    
- (2025) _Algorithmic Structure in Hidden States_ — Lippl et al.  
    Algorithmic reasoning patterns in hidden state organization.
    

### 4.3 Feature Decomposition (SAEs & Superposition)

Decomposing representations into interpretable units.

- (2022) _Toy Models of Superposition_ — Elhage et al. [Transformer Circuits](https://transformer-circuits.pub/2022/toy_model/index.html)  
    Models store more features than dimensions via superposition; motivates sparse decomposition.
    
- (2023) _Towards Monosemanticity_ — Bricken et al. [Transformer Circuits](https://transformer-circuits.pub/2023/monosemantic-features/index.html)  
    SAEs extract interpretable monosemantic features from small Transformers.
    
- (2024) _Scaling Monosemanticity: Features from Claude 3 Sonnet_ — Templeton et al. [Transformer Circuits](https://transformer-circuits.pub/2024/scaling-monosemanticity/index.html)  
    SAE features at production scale; interpretable features in frontier models.
    
- (2023, Sep) _Sparse Autoencoders Find Highly Interpretable Directions_ — Cunningham et al. [arXiv](https://arxiv.org/abs/2309.08600)  
    SAE directions more interpretable than PCA/random baselines.
    
- (2024, Jun) _Scaling and Evaluating Sparse Autoencoders (TopK)_ — Gao et al. [arXiv](https://arxiv.org/abs/2406.04093)  
    TopK activation; systematic scaling and evaluation.
    

### 4.4 Circuits & Causal Localization

Causal and structural explanations of model computation.

- (2021) _A Mathematical Framework for Transformer Circuits_ — Elhage et al. [Transformer Circuits](https://transformer-circuits.pub/2021/framework/index.html)  
    Decomposes attention/MLP into compositional circuits. Foundational mech interp reference.
    
- (2022) _In-context Learning and Induction Heads_ — Olsson et al. [Transformer Circuits](https://transformer-circuits.pub/2022/in-context-learning-and-induction-heads/index.html)  
    Induction heads as key ICL mechanism; emerge as phase transition during training.
    
- (2023, Apr) _Towards Automated Circuit Discovery (ACDC)_ — Conmy et al. [arXiv](https://arxiv.org/abs/2304.14997)  
    Automates circuit discovery via iterative edge pruning.
    
- (2022, Feb) _Locating and Editing Factual Associations in GPT (ROME)_ — Meng et al. [arXiv](https://arxiv.org/abs/2202.05262)  
    Causal tracing localizes factual recall to MLP layers; edits via rank-one updates.
    
- (2023, Apr) _Localizing Model Behavior with Path Patching_ — Goldowsky-Dill et al. [arXiv](https://arxiv.org/abs/2304.05969)  
    Formalizes behavior-to-path attribution as quantifiable test.
    
- (2024, Apr) _How to Use and Interpret Activation Patching_ — Heimersheim et al. [arXiv](https://arxiv.org/abs/2404.15255)  
    Tutorial: what patching can/cannot prove, metric choices, pitfalls.
    
- (2023, Sep) _Towards Best Practices of Activation Patching_ — Zhang et al. [arXiv](https://arxiv.org/abs/2309.16042)  
    Different choices → different conclusions; systematic comparison.
    
- (2023, Jan) _Causal Abstraction for Faithful Model Interpretation_ — Geiger et al. [arXiv](https://arxiv.org/abs/2301.04709)  
    Formalizes whether a high-level algorithm faithfully describes model computation.
    

### 4.5 Internal Reasoning Mechanisms

- (2024, Feb) _Do Large Language Models Latently Perform Multi-Hop Reasoning?_ — Yang et al. [arXiv](https://arxiv.org/abs/2402.16837)  
    Model internally activates bridge entities before completing second hop. **Directly relevant to our VLM reasoning question** (Eiffel Tower → Paris → France).

### 4.6 Steering & Representation Control

Applied interpretability: using representation understanding to intervene on model behavior.

- (2022, Dec) _Discovering Latent Knowledge Without Supervision (CCS)_ — Burns et al. [arXiv](https://arxiv.org/abs/2212.03827)  
    Truth-like directions from activations alone (no labels, no outputs); foundational for reliability in representation space.
    
- (2023, Oct) _Representation Engineering (RepE)_ — Zou et al. [arXiv](https://arxiv.org/abs/2310.01405)  
    Population-level directions/subspaces for controlled intervention; reference for our basis-change analyses.
    
- (2023, Jun) _Inference-Time Intervention (ITI)_ — Li et al. [arXiv](https://arxiv.org/abs/2306.03341)  
    Adds "truthfulness" directions at inference time to steer outputs.
    
- (2025) _A Single Direction of Truth for Detecting and Controlling Hallucinations_ — O'Neill et al.  
    Low-dimensional truth/hallucination direction; detection and causal steering.
    
- (2025, Feb) _Steering the Latent Space of LLMs to Detect Hallucinations_ — Park et al. [arXiv](https://arxiv.org/abs/2502.08629)  
    Complementary to O'Neill; latent-space direction for hallucination detection/manipulation.
    
- (2024, Apr) _ReFT: Representation Finetuning for Language Models_ — Wu et al. [arXiv](https://arxiv.org/abs/2404.03592)  
    Learns interventions on representations instead of weight updates; parameter-efficient.
    
- (2025, Jan) _AXBENCH: Even Simple Baselines Outperform SAEs_ — Wu et al. [arXiv](https://arxiv.org/abs/2501.17148)  
    Benchmarks SAEs vs. probes vs. PCA vs. difference-in-means; simple baselines surprisingly strong. Important methodological reference.
    

### 4.7 Understanding Reasoning & RL Dynamics

Interpreting what happens inside reasoning models and how RL training shapes internal representations. **Directly relevant to analyzing R1-style models with our geometric/trajectory tools.**

**Analyzing Reasoning Internals**

- (2025, Feb) _Demystifying Long Chain-of-Thought Reasoning in LLMs_ — Yeo et al. [arXiv](https://arxiv.org/abs/2502.03373)  
    Analyzes learning dynamics of emergent reasoning under RL: effect of SFT initialization, length reward design, and training progression.
    
- (2025, Mar) _Cognitive Behaviors that Enable Self-Improving Reasoners, or, Four Habits of Highly Effective STaRs_ — Gandhi et al. [arXiv](https://arxiv.org/abs/2503.01307)  
    Why Qwen works better than Llama for RL? Base model already exhibits certain reasoning behaviors; priming helps even with incorrect final answers.
    
- (2025, Mar) _Understanding R1-Zero-Like Training: A Critical Perspective_ — Liu et al.  
    Analyzing base models and RL training dynamics; complements the "aha moment" narrative.
    
- (2025, Apr) _Does Reinforcement Learning Really Incentivize Reasoning Capacity in LLMs Beyond the Base Model?_ — Yue et al.  
    Challenges the role of RL to incentivize new capabilities vs. capitalizing on existing ones.
    
- (2025, Apr) _Echo Chamber: RL Post-training Amplifies Behaviors Learned in Pretraining_ — Sharma et al.  
    RL primarily amplifies existing pretraining behaviors rather than teaching fundamentally new ones.
    
- (2025, Jun) _Thought Anchors: Which LLM Reasoning Steps Matter?_ — [Demo](https://www.thought-anchors.com/)  
    Breaks reasoning chains into sentences; checks causal relations and importances. Sentence taxonomy for reasoning (Table 1, Appendix A).
    
- (2025, Oct) _First Try Matters: Revisiting the Role of Reflection in Reasoning Models_  
    Most reflective behaviors merely confirm rather than alter reasoning; fine-tuning on reflection enhances first-answer correctness.
    

**Representation-Level Analysis of Reasoning**

- (2025, Apr) _Demystifying Reasoning Dynamics with Mutual Information: Thinking Tokens are Information Peaks_ — Ma et al.  
    MI between hidden states and ground truth via HSIC; identifies information-peak tokens in reasoning traces. **Directly connects to our hidden-state trajectory analysis.**
    
- (2025, Feb) _Understanding the Uncertainty of LLM Explanations: A Perspective Based on Reasoning Topology_ — Yan et al. [arXiv](https://arxiv.org/abs/2502.08953)  
    Topological graph representation of reasoning patterns; structured analysis applicable to long reasoning.
    
- (2025, Apr) _Reasoning Models Know When They're Right: Probing Hidden States for Self-Verification_ — Li et al.  
    Probes intermediate reasoning step hidden states to predict final answer correctness; **can use probes for early exit in long reasoning. Directly related to our activation-based evaluation.**
    
- (2025, Sep) _Reasoning Vectors: Transferring Chain-of-Thought Capabilities via Task Arithmetic_ — Sun et al.  
    Extract task vectors (parameter diffs between SFT/GRPO and base) to control reasoning behaviors. **Steering approach applied to reasoning.**
    
- (2025, Nov) _Reinforcement Learning Improves Traversal of Hierarchical Knowledge in LLMs_  
    RL training improves how models traverse internal knowledge hierarchies; connects RL effects to representation structure.
    
- (2025, Sep) _RL's Razor: Why Online Reinforcement Learning Forgets Less_  
    RL incurs less catastrophic forgetting than SFT; implications for representation stability under training.
    

---

## 5. Evaluation & Reliability

How to know if the model is correct: self-assessment, uncertainty quantification, hallucination detection, and benchmarks.

### 5.1 Output-Based Self-Evaluation

- (2022, Jul) _Language Models (Mostly) Know What They Know_ — Kadavath et al. [arXiv](https://arxiv.org/abs/2207.05221)  
    P(True), calibration, knowing-what-you-know; foundational self-evaluation reference.
    
- (2023, Mar) _SelfCheckGPT: Zero-Resource Black-Box Hallucination Detection_ — Manakul et al. [arXiv](https://arxiv.org/abs/2303.08896)  
    Multi-sample consistency → hallucination risk without external retrieval or labels; purely output-based.
    
- (2023, Feb) _Semantic Uncertainty_ — Kuhn et al. [arXiv](https://arxiv.org/abs/2302.09664)  
    Meaning-level entropy over semantically equivalent generations; more robust than token-level.
    

### 5.2 Activation-Based Evaluation

- (2023, Apr) _Internal Representations Tell: Truthfulness Detection_ — Azaria & Mitchell [arXiv](https://arxiv.org/abs/2304.13734)  
    Supervised classifier on activations predicts truthfulness; early evidence for reliability info in hidden states.
    
- (2024) _Truth Plane / Universal Linear Separator_ — Liu et al.  
    Near-universal linear separator for truthfulness across tasks/domains.
    
- (2024, Oct) _Do Large Language Models Know When They Hallucinate?_ — Orgad et al. [arXiv](https://arxiv.org/abs/2410.02707)  
    Generalizability and failure modes of activation-based hallucination probes.
    

### 5.3 Datasets & Benchmarks

- _ScienceQA_ — [Website](https://scienceqa.github.io/)  
    Multimodal science QA with explanations; VLM reasoning evaluation.
    
- (2023, Nov) _GPQA: A Graduate-Level Google-Proof Q&A Benchmark_ — Rein et al. [arXiv](https://arxiv.org/abs/2311.12022)  
    Expert-level questions where domain experts significantly outperform non-experts even with web access.
    
- (2023, Oct) _FActScore: Fine-grained Atomic Evaluation of Factual Precision in Long Form Text Generation_ — Min et al. [arXiv](https://arxiv.org/abs/2305.14251)  
    Decomposes generation into atomic facts and checks each; principled factuality metric.
    
- (2024, Nov) _Measuring Short-form Factuality in Large Language Models (SimpleQA)_ — OpenAI [arXiv](https://arxiv.org/abs/2411.07724)  
    Short-form factual QA benchmark with unambiguous answers; clean evaluation of factual knowledge.
    

---


> Reference:
> - [Post-DeepSeek-R1_LLM-RL Reading List](https://github.com/jzhou316/Post-DeepSeek-R1_LLM-RL)
> - [Foundations and Frontiers of Large Language Models Readings](https://joezhouai.com/llm-course-26/)

