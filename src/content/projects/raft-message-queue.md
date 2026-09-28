---
title: Raft Message Queue (RMQ)
year: 2024
order: 2
tags: [distributed systems, consensus algorithms, Raft, Python, fault tolerance, message queue]
figure: ../../assets/figures/raft.svg
figureAlt: Raft Message Queue architecture
links:
  code: https://github.com/xli0808/RaftMessageQueue
  paper: ""
  demo: ""
---

Distributed message queue system implementing the Raft consensus algorithm for fault-tolerant log replication and leader election. Designed RESTful APIs for topic management, message publication/consumption, and cluster coordination. Implemented thread-safe state machines with distributed log replication, ensuring strong consistency and availability under network partitions. Supports persistent message storage and ordered message delivery across distributed nodes.
