# Overview / Storage Architecture

## 页面定位

建立分布式存储的全景模型，说明访问接口、架构分层与设计目标，为后续专题提供统一坐标。

## 核心问题

- Block / File / Object 分别提供什么抽象，应用承担哪些责任？
- 单机存储演进为分布式存储后，增加了哪些组件与问题？
- 控制面、元数据路径和数据路径如何协作？
- 容量、延迟、吞吐、可用性、持久性与成本如何影响架构选择？

## 已完成：Architecture Entry

1. [Storage Models / Architecture Map](01-storage-models-architecture-map.md)：比较 Block / File / Object 的责任边界，区分 Control / Metadata / Data Path，连接分布式职责与架构目标。

该篇只负责统一坐标与阅读入口；具体保护、协调、元数据、性能与恢复机制仍由后续章节维护，不在本章重复扩写。

[返回 Knowledge Map](../../README.md)
