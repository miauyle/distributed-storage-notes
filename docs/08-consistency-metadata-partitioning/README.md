# Consistency / Metadata / Partitioning

## 页面定位

集中讨论访问者观察到的状态、系统记录的索引，以及逻辑状态的分区、归属与请求路由。第一阶段建立后续提交协调、迁移与恢复可以复用的基础，不展开具体数据库引擎或分区算法实现。

## 核心问题

- 并发读写、覆盖、列举和删除分别需要什么一致性保证？
- 元数据与数据如何关联，更新失败时如何保持可解释的状态？
- Partitioning、Placement、Routing 分别决定什么？
- 状态规模增长后，由谁负责修改，请求如何找到有效 Owner？

## 已完成：第一阶段正文

推荐顺序：**Consistency / Observable State → Metadata / Object Index → Partition / Ownership / Routing**。

| 顺序 | 正文 | 回答的问题 |
| --- | --- | --- |
| 1 | [Consistency / Observable State](01-consistency-observable-state.md) | 客户端应该观察到什么？区分一致性、原子性、持久性与可用性，以及单 Key、Namespace 和多 Key 的边界 |
| 2 | [Metadata / Object Index](02-metadata-object-index.md) | 系统如何记录和定位状态？理解对象索引、布局引用与 Metadata / Data 的提交边界 |
| 3 | [Partition / Ownership / Routing](03-partition-ownership-routing.md) | 状态规模变大后谁负责，请求如何找到它？理解划分、归属、路由与旧 Owner 的修改边界 |

阅读前可回顾 [Object Storage 基础主线](../03-object-storage/README.md) 的 API、读写路径与布局，以及 [Distributed Systems Foundations](../06-distributed-systems/README.md) 的 Timeout、Fencing、Retry。物理保护单元的放置回链 [Failure Domain & Placement](../07-data-protection/03-failure-domain-placement.md)，不与逻辑 Partitioning 混写。

## 后续规划

- Metadata / Data commit coordination：深入发布协议与失败后的状态判定。
- Partition Split / Merge：分区边界与逻辑映射的演进。
- Ownership Migration：归属转移过程中的状态传递与切换。
- Hotspot Mitigation：数据倾斜、Hot Key 与 Hot Partition 的治理。
- Garbage Collection / Reference Cleanup：有效引用判断与物理回收。

这些仍是规划，不表示已有正文。本轮止于三篇基础文章，不展开迁移、回收或 Repair / Recovery。

[分布式协调基础](../06-distributed-systems/README.md) · [返回 Knowledge Map](../../README.md)
