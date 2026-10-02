# Typical Storage Systems

## 页面定位

使用公开系统的架构与文档检验前面建立的通用模型，按统一维度比较设计选择；不做个人项目复盘或产品操作手册合集。

## 核心问题

- 不同系统如何划分访问层、元数据、数据节点与后台任务？
- 相似工作负载下，接口、冗余、放置与恢复有哪些不同取舍？
- 哪些结论属于通用机制，哪些依赖具体系统与版本？

## 第一阶段已完成：Comparison Framework / Object Storage Cases

阅读链为 **统一观察坐标 → Ceph RGW → MinIO**。重点是不同 Architecture Decision 如何实例化通用机制，不是产品功能清单、优劣排名或完整 Object Storage 横评。

| 顺序 | 正文 | 关注的问题 |
| --- | --- | --- |
| 1 | [Storage System Comparison Framework](01-comparison-framework.md) | 如何区分产品事实、通用映射与工程分析？ |
| 2 | [Ceph RGW](02-ceph-rgw.md) | 对象接口如何映射到 RADOS、PG、CRUSH 与 OSD？ |
| 3 | [MinIO](03-minio.md) | 当前 AIStor 如何组织共置 Metadata、Erasure Set 与 Healing？ |

两篇案例保持相同十四个主标题，最后用映射表说明哪些概念仅部分对应。资料核对日期为 2026-10-02：Ceph 使用稳定 Tentacle 分支；MinIO 使用当前 AIStor 滚动文档，不无条件继承历史开源版行为。精确 ACK 或一致性保证没有足够公开证据时，正文明确保留边界。

## 回到通用比较坐标

案例通过相对链接复用基础章节，基础章节既有的典型系统入口在这里汇合，再进入对应案例；不复制一套通用机制正文。

| 坐标 | 前置阅读 |
| --- | --- |
| API 与底层粒度 | [Object Model](../03-object-storage/01-object-model.md)、[Read / Write Path](../03-object-storage/03-read-write-path.md)、[Object Layout](../03-object-storage/06-object-layout.md) |
| 冗余与正确性 | [Replication](../07-data-protection/01-replication.md)、[EC](../07-data-protection/02-erasure-coding.md)、[Placement](../07-data-protection/03-failure-domain-placement.md)、[Integrity](../07-data-protection/04-checksum-data-integrity.md) |
| 状态与定位 | [Metadata / Object Index](../08-consistency-metadata-partitioning/02-metadata-object-index.md)、[Partition / Ownership / Routing](../08-consistency-metadata-partitioning/03-partition-ownership-routing.md) |
| 路径与实验 | [Cost Model](../09-data-path-performance/01-end-to-end-cost-model.md)、[Benchmark](../09-data-path-performance/03-benchmark-bottleneck-analysis.md) |
| 持续运行 | [Repair](../10-recovery-operations-observability/02-repair-rebuild.md)、[Rebalance](../10-recovery-operations-observability/04-rebalance.md)、[Observability](../10-recovery-operations-observability/09-observability-signals.md) |

## 后续规划

- OpenStack Swift：下一阶段沿相同坐标研究，不在本轮创建正文。
- Ceph RGW / MinIO / Swift Cross-system Comparison：三系统案例齐备后再综合对照。
- 按需要再扩展 RBD / CephFS / HDFS / JuiceFS，不预创建空文章。

以上是规划，不表示已完成。本轮止于比较框架与两个对象存储案例，不展开 AI Storage。

[返回 Knowledge Map](../../README.md)
