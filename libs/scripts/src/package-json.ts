import { $ } from 'zx';

$.verbose = false;

type Dependency = {
  from: string;
  version: string;
  path: string;
  dependencies: Dependency[];
};

type PnpmListItem = {
  name: string;
  dependencies: Dependency[];
};

export async function getDependencies (projectName: string) {
  const scope = projectName.startsWith('@') ? projectName.split('/')[0] : undefined
  const depsJson = (
    await $`pnpm --filter ${projectName} list --recursive --depth 3 --json --only prod`
  ).toString();

  const [{ name, dependencies: toplevelDependencies }] = <PnpmListItem[]>JSON.parse(depsJson);

  const dependencies: Record<string, string> = {};

  const queue = [toplevelDependencies];

  while (queue.length) {
    const currentDependencies = queue.pop();
    if (!currentDependencies) continue;
    Object.entries(currentDependencies).forEach(([key, dep]) => {
      if (scope && key.startsWith(`${scope}/`)) {
        if (dep.dependencies) queue.push(dep.dependencies);
        return;
      }
      const existing = dependencies[key];
      if (existing && existing !== dep.version) console.warn(`version conflict ${key} ${dep.version} but found ${existing}`);
      dependencies[key] = existing && existing > dep.version ? existing : dep.version;
    });
  }

  const sortedDependencies = Object.fromEntries(
    Object.keys(dependencies)
      .sort()
      .map((key) => [key, dependencies[key]])
  );

  return {
    name,
    dependencies: sortedDependencies,
  };
}
