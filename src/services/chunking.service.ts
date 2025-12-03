import { config } from "../config";
import { ChunkStrategyConfig, RECURSIVE_SEPARATORS } from "../constants";

/**
 * 子切片结果
 */
export interface ChildChunkResult {
  content: string; // 切片内容
  chunkIndex: number; // 子切片在父切片中的序号
  startPosition: number; // 在原文档中的起始位置
  endPosition: number; // 在原文档中的结束位置
}

/**
 * 父切片结果（包含子切片）
 */
export interface ParentChunkResult {
  content: string; // 父切片内容
  parentIndex: number; // 父切片序号
  startPosition: number; // 在原文档中的起始位置
  endPosition: number; // 在原文档中的结束位置
  children: ChildChunkResult[]; // 子切片列表
}

/**
 * 按策略切割的结果
 */
export interface StrategyChunkResult {
  strategy: ChunkStrategyConfig;
  parentChunks: ParentChunkResult[];
}

/**
 * 文档切割服务
 * 使用递归字符切分和父子索引策略
 */
export class ChunkingService {
  private strategies: ChunkStrategyConfig[];
  private separators: string[];

  constructor(strategies?: ChunkStrategyConfig[], separators?: string[]) {
    this.strategies = strategies || config.chunkStrategies;
    this.separators = separators || RECURSIVE_SEPARATORS;
  }

  /**
   * 使用所有配置的策略切割文档（父子索引）
   * @param content 文档内容
   * @returns 按策略分组的切片结果
   */
  chunkWithAllStrategies(content: string): StrategyChunkResult[] {
    return this.strategies.map((strategy) => ({
      strategy,
      parentChunks: this.chunkWithStrategy(content, strategy),
    }));
  }

  /**
   * 使用单一策略切割文档（父子索引）
   * @param content 文档内容
   * @param strategy 切割策略
   * @returns 父切片结果数组（每个父切片包含子切片）
   */
  chunkWithStrategy(
    content: string,
    strategy: ChunkStrategyConfig
  ): ParentChunkResult[] {
    const { parentChunkSize, childChunkSize, overlapPercent } = strategy;

    if (!content || content.length === 0) {
      return [];
    }

    // 计算实际的重叠字符数
    const parentOverlap = Math.floor(parentChunkSize * (overlapPercent / 100));
    const childOverlap = Math.floor(childChunkSize * (overlapPercent / 100));

    // 第一步：使用递归字符切分创建父切片
    const parentChunks = this.recursiveCharacterSplit(
      content,
      parentChunkSize,
      parentOverlap,
      0 // 原始文档起始位置
    );

    // 第二步：为每个父切片创建子切片
    const result: ParentChunkResult[] = parentChunks.map(
      (parent, parentIndex) => {
        const children = this.recursiveCharacterSplit(
          parent.content,
          childChunkSize,
          childOverlap,
          parent.startPosition // 子切片位置相对于原文档
        );

        return {
          content: parent.content,
          parentIndex,
          startPosition: parent.startPosition,
          endPosition: parent.endPosition,
          children: children.map((child, childIndex) => ({
            content: child.content,
            chunkIndex: childIndex,
            startPosition: child.startPosition,
            endPosition: child.endPosition,
          })),
        };
      }
    );

    return result;
  }

  /**
   * 递归字符切分
   * 按照分隔符优先级递归切分文本
   * @param text 要切分的文本
   * @param chunkSize 目标块大小
   * @param overlap 重叠大小
   * @param basePosition 基础位置偏移
   * @returns 切片结果
   */
  private recursiveCharacterSplit(
    text: string,
    chunkSize: number,
    overlap: number,
    basePosition: number
  ): { content: string; startPosition: number; endPosition: number }[] {
    // 如果文本小于目标大小，直接返回
    if (text.length <= chunkSize) {
      return [
        {
          content: text,
          startPosition: basePosition,
          endPosition: basePosition + text.length,
        },
      ];
    }

    // 尝试使用分隔符切分（已包含重叠内容）
    const chunks = this.splitBySeparators(text, chunkSize, overlap);

    // 将切分结果转换为带位置信息的格式
    // 由于 chunks 已经包含重叠内容，需要通过在原文中查找来确定实际位置
    const result: {
      content: string;
      startPosition: number;
      endPosition: number;
    }[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // 在原文中查找这个 chunk 的位置
      // 对于第一个 chunk，从头开始
      // 对于后续 chunk，从上一个 chunk 结束位置 - overlap 开始搜索
      let searchStart = 0;
      if (i > 0 && result.length > 0) {
        const prevResult = result[result.length - 1];
        // 从上一个块的起始位置之后开始搜索，考虑重叠
        searchStart = Math.max(0, prevResult.startPosition - basePosition + 1);
      }

      // 在原文中查找 chunk 内容的起始位置
      let chunkStartInText = text.indexOf(chunk, searchStart);

      // 如果找不到完全匹配（可能因为重叠内容的拼接方式），
      // 尝试查找 chunk 的核心部分（去掉可能的重叠前缀）
      if (chunkStartInText === -1 && i > 0) {
        // 对于带重叠的块，尝试找到其在原文中的实际位置
        // 通过查找 chunk 中间部分来定位
        const midPoint = Math.floor(chunk.length / 2);
        const searchKey = chunk.slice(midPoint, midPoint + 50);
        const keyPos = text.indexOf(searchKey, searchStart);
        if (keyPos !== -1) {
          chunkStartInText = Math.max(0, keyPos - midPoint);
        } else {
          // 最后手段：基于上一个块的结束位置估算
          chunkStartInText = searchStart;
        }
      }

      if (chunkStartInText === -1) {
        chunkStartInText = searchStart;
      }

      const startPosition = basePosition + chunkStartInText;
      const endPosition = startPosition + chunk.length;

      result.push({
        content: chunk,
        startPosition,
        endPosition,
      });
    }

    return result;
  }

  /**
   * 使用分隔符列表切分文本
   * @param text 要切分的文本
   * @param chunkSize 目标块大小
   * @param overlap 重叠大小
   * @param separatorIndex 当前使用的分隔符索引
   * @returns 切分后的文本块数组
   */
  private splitBySeparators(
    text: string,
    chunkSize: number,
    overlap: number,
    separatorIndex: number = 0
  ): string[] {
    // 如果已经尝试了所有分隔符，使用字符级切分
    if (separatorIndex >= this.separators.length) {
      return this.characterLevelSplit(text, chunkSize, overlap);
    }

    const separator = this.separators[separatorIndex];

    // 空字符串分隔符表示字符级切分
    if (separator === "") {
      return this.characterLevelSplit(text, chunkSize, overlap);
    }

    // 使用当前分隔符切分
    const splits = text.split(separator);

    // 如果分隔符没有效果（只有一个片段），尝试下一个分隔符
    if (splits.length === 1) {
      return this.splitBySeparators(
        text,
        chunkSize,
        overlap,
        separatorIndex + 1
      );
    }

    // 合并小片段（不考虑重叠，先得到基础块）
    const baseChunks: string[] = [];
    let currentChunk = "";

    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      const potentialChunk = currentChunk
        ? currentChunk + separator + split
        : split;

      if (potentialChunk.length <= chunkSize) {
        currentChunk = potentialChunk;
      } else {
        // 当前块已满，保存它
        if (currentChunk) {
          baseChunks.push(currentChunk);
        }

        // 如果单个片段太大，递归使用下一级分隔符
        if (split.length > chunkSize) {
          const subChunks = this.splitBySeparators(
            split,
            chunkSize,
            overlap,
            separatorIndex + 1
          );
          baseChunks.push(...subChunks);
          currentChunk = "";
        } else {
          currentChunk = split;
        }
      }
    }

    // 保存最后一个块
    if (currentChunk) {
      baseChunks.push(currentChunk);
    }

    // 如果只有一个块或没有重叠需求，直接返回
    if (baseChunks.length <= 1 || overlap <= 0) {
      return baseChunks;
    }

    // 添加重叠：为每个块添加前一个块的尾部内容
    return this.addOverlapToChunks(baseChunks, overlap, separator);
  }

  /**
   * 为切分后的块添加重叠内容
   * @param chunks 原始切分块
   * @param overlap 重叠大小
   * @param separator 使用的分隔符
   * @returns 添加重叠后的块数组
   */
  private addOverlapToChunks(
    chunks: string[],
    overlap: number,
    separator: string
  ): string[] {
    const result: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      if (i === 0) {
        // 第一个块不需要添加前置重叠
        result.push(chunks[i]);
      } else {
        // 从前一个块的末尾获取重叠内容
        const prevChunk = chunks[i - 1];
        const overlapContent = this.getOverlapFromEnd(
          prevChunk,
          overlap,
          separator
        );

        if (overlapContent) {
          // 将重叠内容添加到当前块的开头
          result.push(overlapContent + separator + chunks[i]);
        } else {
          result.push(chunks[i]);
        }
      }
    }

    return result;
  }

  /**
   * 从文本末尾获取指定长度的重叠内容
   * 尽量在分隔符边界处截断，保持语义完整性
   * @param text 源文本
   * @param overlap 目标重叠长度
   * @param separator 分隔符
   * @returns 重叠内容
   */
  private getOverlapFromEnd(
    text: string,
    overlap: number,
    separator: string
  ): string {
    if (text.length <= overlap) {
      return text;
    }

    // 从末尾截取 overlap 长度的内容
    const rawOverlap = text.slice(-overlap);

    // 尝试在分隔符边界处截断，使重叠内容更有意义
    // 查找第一个分隔符位置
    const separatorIndex = rawOverlap.indexOf(separator);

    if (separatorIndex !== -1 && separatorIndex < rawOverlap.length - 1) {
      // 从分隔符之后开始，保持语义完整
      return rawOverlap.slice(separatorIndex + separator.length);
    }

    // 如果没有找到合适的分隔符边界，返回原始截取内容
    return rawOverlap;
  }

  /**
   * 字符级切分（最后手段）
   * @param text 要切分的文本
   * @param chunkSize 目标块大小
   * @param overlap 重叠大小
   * @returns 切分后的文本块数组
   */
  private characterLevelSplit(
    text: string,
    chunkSize: number,
    overlap: number
  ): string[] {
    const chunks: string[] = [];
    const step = chunkSize - overlap;

    if (step <= 0) {
      console.warn("切割策略配置错误：overlap 百分比过大导致步长为负");
      return [text];
    }

    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start += step;

      // 防止重叠导致无限循环
      if (start >= end && start < text.length) {
        start = end;
      }
    }

    return chunks;
  }

  /**
   * 获取当前配置的切割策略
   */
  getStrategies(): ChunkStrategyConfig[] {
    return [...this.strategies];
  }

  /**
   * 添加切割策略
   */
  addStrategy(strategy: ChunkStrategyConfig): void {
    this.strategies.push(strategy);
  }
}

export default ChunkingService;
