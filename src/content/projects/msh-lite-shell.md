---
title: msh - Lite Shell
year: 2023
order: 5
tags: [C, systems programming, Unix, process management, signal handling, shell]
figure: ../../assets/figures/unix.webp
figureAlt: msh shell implementation
links:
  code: ""
  paper: ""
  demo: ""
---

Lightweight Linux shell implementation in C demonstrating core operating system concepts. Implemented command parsing and execution using fork/exec system calls, signal handlers for SIGINT/SIGTSTP to support keyboard interruption and job suspension, job control for foreground/background process management, command history persistence with configurable limits, file redirection for batch execution, and built-in commands (jobs, bg, fg, kill, history). Features thread-safe state management and demonstrates low-level system programming with process creation, signal masking, and inter-process communication.
