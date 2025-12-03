import { ChunkingService } from "./src/services/chunking.service";

const service = new ChunkingService();

// 测试 1: 字符级切分（无分隔符）
console.log("========================================");
console.log("测试 1: 字符级切分");
console.log("========================================\n");

const testText1 = `AAAA1111BBBB2222CCCC3333DDDD4444EEEE5555FFFF6666GGGG7777HHHH8888`;

const strategy1 = {
  name: "test",
  parentChunkSize: 200,
  childChunkSize: 20,
  overlapPercent: 25, // 25% 重叠 = 5 字符
};

const result1 = service.chunkWithStrategy(testText1, strategy1);
console.log("原文:", testText1);
console.log("\n子切片:");
result1[0]?.children.forEach((child, j) => {
  console.log(`  ${j}: [${child.content}]`);
});
checkOverlap(result1[0]?.children || []);

// 测试 2: 使用换行分隔符切分
console.log("\n========================================");
console.log("测试 2: 换行分隔符切分");
console.log("========================================\n");

const testText2 = `第一行内容AAAA
第二行内容BBBB
第三行内容CCCC
第四行内容DDDD
第五行内容EEEE
第六行内容FFFF`;

const strategy2 = {
  name: "test",
  parentChunkSize: 200,
  childChunkSize: 30,
  overlapPercent: 30,
};

const result2 = service.chunkWithStrategy(testText2, strategy2);
console.log("原文:", testText2.replace(/\n/g, "\\n"));
console.log("\n子切片:");
result2[0]?.children.forEach((child, j) => {
  console.log(`  ${j}: [${child.content.replace(/\n/g, "\\n")}]`);
});
checkOverlap(result2[0]?.children || []);

// 测试 3: 使用双换行分隔符切分
console.log("\n========================================");
console.log("测试 3: 双换行分隔符切分（段落）");
console.log("========================================\n");

const testText3 = `第一段内容，这里是开头。

第二段内容，这里是中间部分一。

第三段内容，这里是中间部分二。

第四段内容，这里是结尾部分。`;

const strategy3 = {
  name: "test",
  parentChunkSize: 200,
  childChunkSize: 50,
  overlapPercent: 20,
};

const result3 = service.chunkWithStrategy(testText3, strategy3);
console.log("原文:", testText3.replace(/\n/g, "\\n"));
console.log("\n子切片:");
result3[0]?.children.forEach((child, j) => {
  console.log(`  ${j}: [${child.content.replace(/\n/g, "\\n")}]`);
});
checkOverlap(result3[0]?.children || []);

function checkOverlap(children: any[]) {
  console.log("\n--- 重叠检查 ---");
  if (children.length <= 1) {
    console.log("只有一个切片，无需检查重叠");
    return;
  }

  for (let i = 1; i < children.length; i++) {
    const prev = children[i - 1];
    const curr = children[i];

    // 查找共同内容
    let foundOverlap = false;
    for (
      let len = Math.min(prev.content.length, curr.content.length);
      len > 0;
      len--
    ) {
      const prevEnd = prev.content.slice(-len);
      if (curr.content.startsWith(prevEnd)) {
        console.log(`子切片 ${i - 1} -> ${i}: ✅ 重叠 ${len} 字符`);
        foundOverlap = true;
        break;
      }
    }
    if (!foundOverlap) {
      console.log(`子切片 ${i - 1} -> ${i}: ❌ 无重叠`);
    }
  }
}
