---
title: Netty-Spring-ZK RPC Framework
year: 2023
order: 4
tags: [RPC, Netty, ZooKeeper, Spring, distributed systems, microservices, Java]
figure: ../../assets/figures/netty.png
figureAlt: Netty-Spring-ZK RPC Framework architecture
links:
  code: ""
  paper: ""
  demo: ""
---

High-performance lightweight RPC framework built with Netty for NIO-based network communication, ZooKeeper for service registration/discovery, and Spring for dependency injection. Implemented custom message protocol with codec to solve TCP sticky packet/fragmentation issues, multiple serialization algorithms (JDK, JSON, Protostuff), load balancing (round-robin, random, consistent hashing), dynamic proxy (JDK/CGLIB), channel multiplexing, asynchronous invocation with CompletableFuture, heartbeat mechanism, and fault tolerance with token bucket flow control. Supports service local caching with dynamic updates and Guava-Retry for idempotent service retries.
