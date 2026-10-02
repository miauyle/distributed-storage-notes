# AI Storage Connections

## 页面定位

将已有 Distributed Storage 模型映射到 AI Training / Inference Workload：什么状态要保存、数据如何供给计算、失败后如何恢复。这里仍是分布式存储知识库的连接章节，不扩展成 AI Systems、深度学习或个人面试教程，也不复制 ai-storage-notes。

## 已完成第一阶段：AI Storage Workloads / Training State

按 **AI Storage Workload Model → Training Data Path → Model Weights / Checkpoints** 阅读，形成 **Workload → Data Supply → Durable Training State**。

| 顺序 | 文章 | 回答的问题 |
| --- | --- | --- |
| 1 | [AI Storage Workload Model：同一组存储机制，不同状态优先级](01-ai-storage-workload-model.md) | Dataset / Weight / Checkpoint / Optimizer State / 临时数据 / KV Cache 有何不同；持久化、重建与应用 Outcome 怎样分类？ |
| 2 | [Training Data Path：存储字节怎样成为 GPU 可消费的 Batch](02-training-data-path.md) | Sample 与 Object / File 如何映射；数据怎样经过读取、CPU 准备、Host / Pinned Memory 和 H2D；怎样验证流水线重叠与输入瓶颈？ |
| 3 | [Model Weights / Checkpoints：加载模型与恢复训练是两种路径](03-model-weights-checkpoints.md) | Weight fan-out、Sharded State、Checkpoint 写入 / 发布、异步完成与 Restore 怎样对应已有存储模型？ |

DataLoader 与 Distributed Checkpoint 使用当前 PyTorch 官方文档实例，并在正文记录 stable 指向版本与核对日期。机制定义复用已有章节；流程、状态与资源例子标为通用模型，不推断产品内部实现。

## 阅读前置与关键边界

- [Object Model](../03-object-storage/01-object-model.md)、[Read / Write Path](../03-object-storage/03-read-write-path.md)、[Object Layout](../03-object-storage/06-object-layout.md)：逻辑状态、存储粒度和准备 / 发布。
- [Data Protection](../07-data-protection/README.md)、[Backup / Restore](../07-data-protection/07-backup-restore.md)、[Repair / Rebuild](../10-recovery-operations-observability/02-repair-rebuild.md)：持久材料、恢复依赖与有效完成。
- [Data Path / Performance](../09-data-path-performance/README.md)：成本、排队、Cache / Prefetch、共享干扰、Copy 与提交 / 完成。

第一阶段建立：Dataset ≠ Checkpoint；Weight ≠ KV Cache；Sample ≠ Object / File；对象吞吐 ≠ GPU 数据供给率；高存储吞吐 ≠ 高 GPU 利用率；Pinned Memory ≠ GDS；Bytes Written ≠ Checkpoint Committed；Async Started ≠ 新持久恢复点可用；Checkpoint Exists ≠ Fast Restore；Cacheable ≠ 不需持久保护。

## 后续规划：第二阶段 GPU Data Path

以下仅是待展开方向，没有创建正文：

- Host / Pinned Memory → GPU 的复制、DMA、重叠与生命周期。
- GPUDirect Storage 的路径、适用条件与回退边界。
- Object Storage / cuObject 与 GPU-oriented Storage Access。
- RDMA、GPU Direct 与对象协议之间的关系。

## 后续规划：第三阶段 Inference State / KV Cache

以下仅是待展开方向，没有创建正文：

- KV Cache 状态模型、身份与生命周期。
- 分层、共享、淘汰及复用正确性。
- Remote / Disaggregated Cache 与资源竞争。
- 重建成本、持久化边界及端到端验证。

本轮止于第一阶段三篇，不展开 GDS、S3 over RDMA、KV Cache 机制、推理产品案例或 Demo。

[数据路径与性能基础](../09-data-path-performance/README.md) · [对象存储主线](../03-object-storage/README.md) · [返回 Knowledge Map](../../README.md)
