---
title: End-to-end Cell Recognition via BERT-style Translation
year: 2025
featured: true
order: 1
tags: [transformers, 3D, self-supervised, computer vision]
figure: ../../assets/figures/cell.png
figureAlt: Cell recognition pipeline
links:
  code: ""
  paper: ""
  demo: ""
---

Novel approach to 3D cell recognition by representing point clouds as token sequences and applying BERT-style transformer architecture. Implemented masked point modeling and contrastive pretraining for self-supervised learning on synthetic high-overlap cell pairs. Built encoder-decoder architecture that translates point clouds directly to cell identities, achieving AUROC > 0.85 with ~1ms inference latency per cell, eliminating the need for traditional multi-stage cell tracking pipelines.
