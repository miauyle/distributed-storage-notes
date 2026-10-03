# Storage Fundamentals

## 页面定位

补齐理解分布式存储所需的单机介质、I/O 与持久化基础；关注它们如何约束上层设计。

## 核心问题

- 应用写入成功与数据持久化之间有哪些边界？
- 随机 / 顺序 I/O、小 / 大请求的成本为什么不同？
- 缓存、缓冲与刷盘如何影响性能和故障后的数据状态？
- IOPS、带宽、延迟、队列深度与容量应如何一起理解？

## 已完成：Storage Fundamentals

推荐顺序：**Persistence Boundary → Device Cost Model**。

| 顺序 | 正文 | 回答的问题 |
| --- | --- | --- |
| 1 | [I/O Path / Persistence](01-io-path-persistence.md) | Write Return、Data / Metadata Persistence、Ordering、Atomicity 与故障后的恢复状态如何区分？ |
| 2 | [Media / Performance / Amplification](02-media-performance-amplification.md) | 介质与接口、请求粒度、IOPS / Bandwidth / Latency、Queue Depth 和内部放大怎样影响成本？ |

本章提供理解分布式存储所需的单机前置，不扩成 Linux / SSD 教科书。端到端成本、排队分析及高性能路径由 [09 Data Path / Performance](../09-data-path-performance/README.md) 承接，对象提交与副本 ACK 由各自专题维护。

[返回 Knowledge Map](../../README.md)
