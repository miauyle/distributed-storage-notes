# Distributed Systems

## 页面定位

整理存储系统依赖的分布式协调基础，重点解释系统假设、失败条件与协议边界；应用可见的一致性另见专题。

## 核心问题

- 超时能否证明节点或操作已经失败？
- 网络分区、节点崩溃与时钟偏差如何影响决策？
- 共识、Quorum、Leader 与 Lease 分别解决什么问题？
- 重试、重复请求与成员变更如何避免破坏系统状态？

## 后续准备展开的主题

- 故障模型、网络分区、超时和故障检测的不确定性。
- CAP 的适用边界；共识、Quorum 与复制的概念区分。
- Leader 选举、Lease、Fencing 与成员变更。
- 幂等、去重、重试与分布式任务协调。

[一致性 / 元数据 / 分区](../08-consistency-metadata-partitioning/README.md) · [返回 Knowledge Map](../../README.md)
