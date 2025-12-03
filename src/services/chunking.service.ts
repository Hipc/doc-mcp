import { config } from "../config";
import { ChunkStrategyConfig } from "../constants";

/**
 * 文档切片结果
 */
export interface ChunkResult {
  content: string; // 切片内容
  chunkIndex: number; // 切片序号
  startPosition: number; // 起始位置
  endPosition: number; // 结束位置
}

/**
 * 按策略切割的结果
 */
export interface StrategyChunkResult {
  strategy: ChunkStrategyConfig;
  chunks: ChunkResult[];
}

/**
 * 文档切割服务
 * 支持多种切割策略，保留细节
 */
export class ChunkingService {
  private strategies: ChunkStrategyConfig[];

  constructor(strategies?: ChunkStrategyConfig[]) {
    this.strategies = strategies || config.chunkStrategies;
  }

  /**
   * 使用所有配置的策略切割文档
   * @param content 文档内容
   * @returns 按策略分组的切片结果
   */
  chunkWithAllStrategies(content: string): StrategyChunkResult[] {
    return this.strategies.map((strategy) => ({
      strategy,
      chunks: this.chunkWithStrategy(content, strategy),
    }));
  }

  /**
   * 使用单一策略切割文档
   * @param content 文档内容
   * @param strategy 切割策略
   * @returns 切片结果数组
   */
  chunkWithStrategy(
    content: string,
    strategy: ChunkStrategyConfig
  ): ChunkResult[] {
    const { chunkSize, overlap } = strategy;
    const chunks: ChunkResult[] = [];

    if (!content || content.length === 0) {
      return chunks;
    }

    // 如果内容长度小于块大小，直接返回整个内容作为一个块
    if (content.length <= chunkSize) {
      return [
        {
          content,
          chunkIndex: 0,
          startPosition: 0,
          endPosition: content.length,
        },
      ];
    }

    let startPosition = 0;
    let chunkIndex = 0;

    while (startPosition < content.length) {
      // 计算结束位置
      let endPosition = Math.min(startPosition + chunkSize, content.length);

      // 尝试在自然断点处切割（句号、换行符等）
      if (endPosition < content.length) {
        endPosition = this.findNaturalBreakpoint(
          content,
          startPosition,
          endPosition
        );
      }

      const chunkContent = content.slice(startPosition, endPosition);

      chunks.push({
        content: chunkContent,
        chunkIndex,
        startPosition,
        endPosition,
      });

      // 计算下一个块的起始位置（考虑重叠）
      const step = chunkSize - overlap;
      startPosition = startPosition + step;

      // 如果剩余内容太少，确保至少前进一些
      if (startPosition >= endPosition && startPosition < content.length) {
        startPosition = endPosition;
      }

      chunkIndex++;

      // 防止无限循环
      if (step <= 0) {
        console.warn("切割策略配置错误：overlap 不应大于或等于 chunkSize");
        break;
      }
    }

    return chunks;
  }

  /**
   * 在自然断点处切割，优先级：段落 > 句子 > 词
   * @param content 内容
   * @param start 搜索起始位置
   * @param end 当前结束位置
   * @returns 调整后的结束位置
   */
  private findNaturalBreakpoint(
    content: string,
    start: number,
    end: number
  ): number {
    // 定义搜索范围（在结束位置附近寻找断点）
    const searchRange = Math.min(100, end - start);
    const searchStart = end - searchRange;
    const searchEnd = Math.min(end + searchRange, content.length);
    const searchText = content.slice(searchStart, searchEnd);

    // 优先级1：寻找段落断点（双换行）
    const paragraphBreak = this.findLastMatch(
      searchText,
      /\n\n|\r\n\r\n/g,
      searchRange
    );
    if (paragraphBreak !== -1) {
      return searchStart + paragraphBreak;
    }

    // 优先级2：寻找句子断点
    const sentenceBreak = this.findLastMatch(
      searchText,
      /[。！？.!?]\s*/g,
      searchRange
    );
    if (sentenceBreak !== -1) {
      return searchStart + sentenceBreak;
    }

    // 优先级3：寻找换行断点
    const lineBreak = this.findLastMatch(searchText, /\n|\r\n/g, searchRange);
    if (lineBreak !== -1) {
      return searchStart + lineBreak;
    }

    // 优先级4：寻找词断点（空格、逗号等）
    const wordBreak = this.findLastMatch(
      searchText,
      /[\s,，;；]/g,
      searchRange
    );
    if (wordBreak !== -1) {
      return searchStart + wordBreak;
    }

    // 没有找到自然断点，使用原始位置
    return end;
  }

  /**
   * 在文本中查找最后一个匹配的位置
   * @param text 搜索文本
   * @param pattern 正则模式
   * @param preferPosition 优先位置
   * @returns 匹配位置，未找到返回 -1
   */
  private findLastMatch(
    text: string,
    pattern: RegExp,
    preferPosition: number
  ): number {
    let lastMatch = -1;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      // 找到最接近优先位置且不超过它的匹配
      if (match.index <= preferPosition) {
        lastMatch = match.index + match[0].length;
      }
    }

    return lastMatch;
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
