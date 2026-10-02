# Consistency / Observable State：客户端应该看到什么

同一个 Key 原先保存 `A`，客户端把它覆盖成 `B`。写入返回成功后，另一个客户端 GET 得到 `A`，这是允许的旧状态、缓存问题，还是系统违反了承诺？如果两个写入同时成功，哪个值应该成为 Current Object？这些问题不能只靠“数据已经复制了几份”回答。

本文从 **客户端可观察的操作历史** 建立一致性边界，再把问题交给 [Metadata / Object Index](02-metadata-object-index.md)：系统如何记录这个状态。以下时间线和状态例子是通用模型；Amazon S3 的具体契约单独列出，不用于推断所有对象存储的行为。

## 1. Consistency guarantee 约束操作历史

一次操作有调用开始、返回结果两个边界。Consistency guarantee 规定：在写入、读取、删除、列举相互交错时，哪些返回值与顺序是合法的。

它不直接规定内部必须有几个副本、一个 Leader 或某种数据库，也不要求所有节点在同一物理时刻拥有相同字节。系统可以在后台传播状态，只要对外提供的操作历史满足契约。反过来，内部有冗余和 Quorum，也不能单凭这些词证明某种一致性保证；协调基础见 [Quorum / Leader / Lease / Fencing](../06-distributed-systems/02-quorum-leader-lease-fencing.md)。

首先要分开四个经常混用的维度：

| 维度 | 约束什么 | 单次覆盖写的例子 |
| --- | --- | --- |
| Atomicity | 指定操作边界内，更新是否作为整体生效 | GET 得到完整 `A` 或完整 `B`，不会拼出半个 `A` 加半个 `B`；多对象原子性是另外的边界 |
| Consistency | 观察结果是否符合约定的状态与顺序 | 写 `B` 成功后发起的 GET，是否还允许返回 `A` |
| Durability | 已承诺的状态在指定故障条件下能否保存、恢复 | 写入成功后，在保护模型允许的节点故障下仍能恢复 `B` |
| Availability | 在约定条件下，操作能否完成并满足服务契约 | 网络故障时是否仍能完成 GET / PUT，还是必须拒绝或等待 |

这四个维度会影响彼此的实现，但不是同一种保证。读到了 `B` 不证明 `B` 已满足持久化条件；保存了 `B` 的字节不证明当前索引会把它返回给用户。这里的 Consistency 指分布式访问的一致性模型，也不直接等同于 ACID 中“维护应用约束”的 C。

## 2. Read-after-write 与 Linearizable Consistency

**Read-after-write** 回答一个具体问题：写入完成以后发起的读取，能否看到该写入或之后的更新？需要检查契约的适用范围：仅同一客户端，还是任意客户端；仅新建，还是也包含覆盖、删除。

**Linearizable Consistency（线性一致性）** 的核心要求更完整：每个操作都能被解释为在调用与返回之间的某一点生效，所有操作组成一个符合对象规则的顺序，并保留不重叠操作的真实先后关系。这是可观察历史的要求，不要求使用客户端时间戳作为排序依据。[Herlihy / Wing 原论文](https://cs.brown.edu/people/mph/HerlihyW90/p463-herlihy.pdf) 给出了这一模型。

下面假设一个支持原子替换的单 Key 寄存器，初值为 `A`，除表内操作外没有其他修改，所有读取直接访问该接口，不经过另有语义的缓存：

| 操作关系 | 在线性一致模型下允许观察什么 |
| --- | --- |
| PUT `B` 成功返回，然后 GET 开始；没有其他写入 | GET 返回 `B` |
| PUT `B` 与 GET 时间区间重叠 | GET 可以返回 `A` 或 `B`，取决于两者被放入的合法顺序；不能返回混合对象 |
| PUT `B` 完成后才发起 PUT `C`；后者成功后发起 GET | GET 返回 `C` |
| PUT `B` 与 PUT `C` 重叠；两者成功后发起 GET | GET 返回所选合法顺序中的最后一个值，可能是 `B`，也可能是 `C` |

两个并发写入都成功，表示它们都曾作为有效操作生效，不表示两个值同时成为 Current Object。仅比较两个 Response 的到达顺序，也不能确定重叠写入的生效顺序。真正有约束力的是操作是否重叠，以及接口定义的并发规则。

“Strong Consistency”在不同系统中的使用范围可能不同。评估接口时应读到具体保证，而不是看到 Strong 就推断它同时承诺多对象事务、所有配置立即生效和跨分页快照。

还有一个重要边界：PUT Timeout 没有成功 Response，但写入可能已经生效。线性一致性不会消除客户端的 **Unknown Result**；后续读取可能看到 `B`。如何解释未完成操作以及安全重试，应回到 [Failure / Timeout](../06-distributed-systems/01-failure-model-timeout.md) 和 [Retry / Idempotency](../06-distributed-systems/03-retry-idempotency-deduplication.md)，不能把 Timeout 当成一次确认的回滚。

## 3. Stale Read 与 Eventual Consistency

Stale Read 是读取到了某个已经被后续更新取代的状态。它是否违反保证，要看操作时间关系和接口契约：与写入重叠的 GET 返回旧值，在上面的线性一致模型中可以合法；写入完成后才开始的 GET 返回旧值，则不符合该模型。

**Eventual Consistency（最终一致性）** 的核心是收敛：若更新停止，通信与状态传播能够继续，冲突处理规则也能完成，各处最终对同一逻辑状态达成一致。它本身不承诺收敛耗时，也不自动提供 Read-after-write。

例如一个读取入口暂时只知道 `A`，另一个已经返回 `B`。最终一致模型可以允许这段差异；系统还需要决定并发的 `B`、`C` 如何处理，不能仅说“等一等自然就一致”。收敛到一个当前状态，也不表示所有并发写入都会被保留为独立版本。Dynamo 的[原始论文 §4.4](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf) 是异步传播与版本冲突的公开案例，不是所有最终一致系统的统一实现。

工程上的交换是：允许更多读取入口用本地已知状态回答，可以减少协调等待；应用却可能需要处理旧值、冲突和重复观察。若传播长期受阻，不能假定“最终”意味着固定几秒后必然最新。旧值也不等于新数据已经永久丢失：可见性、远端可达性和持久性仍是不同的问题。

## 4. Per-key consistency 不等于多 Key 原子事务

假设应用有两个 Key：`data` 与 `manifest`。依次把它们从 `D0 / M0` 更新为 `D1 / M1`：

| 时刻 | `data` | `manifest` | 含义 |
| --- | --- | --- | --- |
| 更新前 | `D0` | `M0` | 旧的一组应用状态 |
| 仅第一步成功 | `D1` | `M0` | 两个单 Key 操作都可以合法，但应用组合状态可能不满足要求 |
| 两步完成 | `D1` | `M1` | 新的一组应用状态 |

每个 Key 的读写都线性一致，仍然可以出现中间状态，因为接口并未定义“同时修改两个 Key”这个原子操作。线性一致性可以按对象组合推理，但组合不会凭空增加一个多对象事务接口。

即使系统提供了原子的多 Key 写入，客户端两个独立 GET 仍可能跨越该写入的生效点，读到旧 `data` 和新 `manifest`。需要一致的组合视图时，还应检查读取是否有事务或 Snapshot 边界。不能把“单次写入原子”扩大成“任意一组客户端操作原子”。

## 5. LIST 观察的是 Namespace

GET 回答某个 Key 的状态；LIST 回答一个 Namespace 中有哪些条目。后者往往经过不同的索引与遍历路径，具体职责见 [Metadata / Object Index](02-metadata-object-index.md)。

因此，单 Object GET 的一致性不能自动推出 LIST 的一致性。一个系统可以承诺 GET 最新，却允许 Namespace Index 延迟；也可以明确承诺写入成功后的 LIST 立即反映变化，此时内部发布与索引更新必须支持这一对外保证。

还要区分 **单次 LIST 的观察保证** 和 **多个分页请求共享同一个 Snapshot**。分页之间有并发更新时，一页的契约不能自动扩大到整个遍历会话。已有 [S3 Core Semantics](../03-object-storage/02-s3-core-semantics.md) 解释了 API 层的列举边界，本篇不重新展开分页用法。

## 6. 条件写阻止无意覆盖，边界仍是被检查的状态

两个客户端先读取同一旧状态，再分别计算新值。普通覆盖写可能把另一个人的结果覆盖掉。条件写把“我读到的状态仍有效”与更新绑定：服务端在决定更新是否生效时检查条件，匹配才允许写入，不匹配则让调用者重新评估。

这与客户端先 HEAD、判断后再发普通 PUT 不同：后者的检查和写入之间仍有竞争窗口。条件写解决的是受保护状态上的并发覆盖；它不会自动检查另一个 Key 的状态，更不会自动成为多对象事务。

条件比较的 Token 也必须符合需求。内容校验标识、对象 Generation 和 Ownership Epoch 约束不同事实；内容相同不保证所有 Metadata 都未变化。应用不能把任意 ETag 都当成完整状态的唯一版本号，也不能用对象 Generation 证明某个节点仍有修改资格。

## 7. Amazon S3 案例的适用边界

**产品行为，核对日期：2026-10-02。** 这里沿用已有 S3 文章的常规场景：General Purpose Bucket 中普通对象请求，以未启用过 Versioning 的单 Key 例子说明覆盖；不把外部缓存、桶配置变更或跨 Key 更新纳入同一保证。

AWS 当前[一致性文档](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html#ConsistencyModel) 明确说明对象 PUT、覆盖与 DELETE 的强 Read-after-write，一次 Key 更新的原子性，以及成功写入后发起的 GET / LIST 对变化的反映；对象 HEAD 也在强一致范围内。文档同时说明跨 Key 不提供原子更新。这里引用的是这些公布的操作保证，不以 Strong 标签代替对完整形式化模型的证明。

AWS 的[条件写文档](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html) 描述了 `If-None-Match` 与基于 ETag 的 `If-Match`。它们是 S3 支持的具体条件，不代表所有存储系统都使用相同 Token，也不增加跨对象事务能力。具体 API 状态和重试仍以 [S3 Core Semantics](../03-object-storage/02-s3-core-semantics.md) 为入口。

## 8. 把可观察保证交给 Metadata

现在的问题变为：系统如何把“当前是 `B`”记录成可恢复的状态，并保证 GET、HEAD、LIST 不各自选择互相冲突的记录？[下一篇](02-metadata-object-index.md) 从 Object Index 与 Layout Reference 讨论这一发布边界，而不是预设某个产品的数据库实现。

[下一篇：Metadata / Object Index](02-metadata-object-index.md) · [返回章节入口](README.md)
