# Data Path / Performance

## 页面定位

沿请求实际经过的路径拆解时间和资源开销，建立可测量的性能分析方法。第一阶段连接成本位置、吞吐与排队、可复现实验；第二阶段讨论缓存、工作粒度与共享资源控制；第三阶段补齐内存移动、设备 I/O 与跨节点传输的高性能路径边界。

## 核心问题

- 一次读写经过哪些 CPU、内存、网络与设备环节？
- 如何区分元数据、网络、介质和后台任务造成的瓶颈？
- 请求大小、并发、缓存与队列如何影响吞吐和尾延迟？
- 什么样的基准测试能够公平反映真实工作负载？

## 已完成第一阶段：Performance Analysis Foundations

推荐顺序：**End-to-End Cost Model → Latency / Throughput / Queueing → Benchmark / Bottleneck Analysis**。

| 顺序 | 正文 | 回答的问题 |
| --- | --- | --- |
| 1 | [End-to-End Cost Model](01-end-to-end-cost-model.md) | 性能成本在哪里？沿控制与正文路径区分执行、等待、内部流量与端到端边界 |
| 2 | [Latency / Throughput / Queueing](02-latency-throughput-queueing.md) | 成本怎样形成吞吐与尾延迟？理解并发、饱和、Little’s Law 和分布式等待条件 |
| 3 | [Benchmark / Bottleneck Analysis](03-benchmark-bottleneck-analysis.md) | 怎样找出真正限制？记录 Workload、Environment、Measurement Boundary，受控改变变量并检验候选解释 |

三篇形成 **Cost → Queueing → Measurement**：成本模型提出候选位置，指标关系解释运行表现，实验验证瓶颈及其适用范围。先建立分析方法，不把优化技术清单当成诊断结果。

前置复用 [Object Read / Write Path](../03-object-storage/03-read-write-path.md)、[Object Layout](../03-object-storage/06-object-layout.md)、[Data Protection](../07-data-protection/README.md) 与 [Recovery Task Coordination](../10-recovery-operations-observability/03-recovery-task-coordination.md)。单机介质、I/O 与持久化仍由 [Storage Fundamentals](../02-storage-fundamentals/README.md) 承担，本章不重复底层教材。

## 已完成第二阶段：Optimization / Control

承接第一阶段，推荐顺序：**Cache / Prefetch → Batching / Backpressure → Foreground / Background Interference**。

| 顺序 | 正文 | 回答的问题 |
| --- | --- | --- |
| 4 | [Cache / Prefetch](04-cache-prefetch.md) | 如何减少慢层访问？区分命中口径、状态有效性和预取的收益与浪费 |
| 5 | [Batching / Backpressure](05-batching-backpressure.md) | 如何摊薄固定成本、控制并发与积压？明确等待代价及过载反馈边界 |
| 6 | [Foreground / Background Interference](06-foreground-background-interference.md) | 多种工作如何共享资源？连接 Repair / Rebalance / Migration 的竞争、预算和动态取舍 |

前两阶段形成 **Cost → Queueing → Measurement → Optimization / Control**。控制措施要回到第一阶段验证：高命中、大 Batch 或高后台带宽，不自动意味着更好的端到端服务；正确性与保护契约也不能为性能让步。

## 已完成第三阶段：High-performance Data Path

承接资源控制，推荐顺序：**Memory Copy / Zero-copy → Direct / Async I/O & Device Path → High-performance Networking / RDMA**。

| 顺序 | 正文 | 回答的问题 |
| --- | --- | --- |
| 7 | [Memory Copy / Zero-copy](07-memory-copy-zero-copy.md) | 数据为什么多次读写内存？区分 Copy、Syscall、Context Switch、DMA 与 Buffer 生命周期 |
| 8 | [Direct / Async I/O & Device Path](08-direct-async-io-device-path.md) | 怎样到达设备？分开缓存路径、提交 / 完成模型与持久化条件 |
| 9 | [High-performance Networking / RDMA](09-high-performance-networking-rdma.md) | 怎样跨节点搬运？理解注册内存、工作队列以及传输完成不等于存储提交 |

三阶段形成 **Analysis → Control → Low-level Data Path**：先测清成本与等待，再约束工作和共享资源，最后讨论局部路径怎样降低开销。Zero-copy 不等于字节不移动，Direct 不等于 Zero-copy，Async 不保证单请求更快，RDMA Completion 也不代替应用提交与存储 Durability。

## 后续规划

- 高性能路径的受控实验与成本验证，按明确任务确定范围。
- AI / GPU Data Path Connection，由 [AI Storage Connections](../12-ai-storage-connections/README.md) 后续承接。

以上仍为规划，不表示已有正文。当前止于三阶段九篇通用基础，不展开 GPU、GDS、S3 over RDMA 或 AI Storage 教程。

[Storage Fundamentals](../02-storage-fundamentals/README.md) · [返回 Knowledge Map](../../README.md)
