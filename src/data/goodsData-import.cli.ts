import fs from 'node:fs';
import path from 'node:path';

import { FnBuildGoodsDataModuleSource, FnConvertGoodsImportPayload } from './goodsData-importer';

type CliOptions = {
  inputPath: string | null;
  outputPath: string | null;
  arrayOnly: boolean;
};

export function FnGetDefaultGoodsDataSourcePath(): string {
  return path.resolve(__dirname, 'goodsData-source.json');
}

function FnParseCliOptions(argv: string[]): CliOptions {
  let inputPath: string | null = null;
  let outputPath: string | null = null;
  let arrayOnly = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--array-only') {
      arrayOnly = true;
      continue;
    }

    if (arg === '--out') {
      outputPath = argv[index + 1] ? path.resolve(argv[index + 1]) : null;
      index += 1;
      continue;
    }

    if (!inputPath) {
      inputPath = path.resolve(arg);
    }
  }

  return { inputPath, outputPath, arrayOnly };
}

function FnReadInput(inputPath: string | null): string {
  const resolvedPath = inputPath || FnGetDefaultGoodsDataSourcePath();
  return fs.readFileSync(resolvedPath, 'utf8');
}

async function FnMain() {
  const options = FnParseCliOptions(process.argv.slice(2));
  const rawInput = FnReadInput(options.inputPath).trim();

  if (!rawInput) {
    throw new Error('입력 JSON이 비어 있습니다.');
  }

  const parsed = JSON.parse(rawInput);
  const items = FnConvertGoodsImportPayload(parsed);
  const output = options.arrayOnly
    ? `${JSON.stringify(items, null, 2)}\n`
    : FnBuildGoodsDataModuleSource(items);

  if (options.outputPath) {
    fs.writeFileSync(options.outputPath, output, 'utf8');
    return;
  }

  process.stdout.write(output);
}

FnMain().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
