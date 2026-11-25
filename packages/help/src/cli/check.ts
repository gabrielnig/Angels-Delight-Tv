import { checkContent, findContentDir, loadLibrary } from '../node';

/** pnpm help:check. Validates every help article and the glossary, lints the copy and checks the pictures. */
try {
  const dir = findContentDir();
  const lib = loadLibrary(dir);
  const problems = checkContent(dir);
  if (problems.length) {
    console.error(
      `help:check found ${problems.length} problem${problems.length === 1 ? '' : 's'}:`,
    );
    for (const p of problems) console.error(`- ${p}`);
    process.exit(1);
  }
  console.log(
    `help:check ok: ${lib.articles.length} articles, ${lib.paths.length} paths, ${lib.glossary.length} glossary terms.`,
  );
} catch (error) {
  console.error(`help:check failed: ${(error as Error).message}`);
  process.exit(1);
}
