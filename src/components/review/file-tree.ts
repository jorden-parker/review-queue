export type FileTreeNode = { name: string; path: string; children: FileTreeNode[] | null };

function byName(left: FileTreeNode, right: FileTreeNode): number {
  return left.name.localeCompare(right.name);
}

function segmentsOf(path: string): string[] {
  return path.split("/");
}

function fileNode(path: string, name: string): FileTreeNode {
  return { name, path, children: null };
}

function directoryNode(name: string, members: string[], depth: number): FileTreeNode {
  const path = segmentsOf(members[0])
    .slice(0, depth + 1)
    .join("/");
  const children = childNodes(members, depth + 1);
  const [onlyChild] = children;
  if (children.length === 1 && onlyChild.children !== null) {
    return {
      name: `${name}/${onlyChild.name}`,
      path: onlyChild.path,
      children: onlyChild.children,
    };
  }
  return { name, path, children };
}

function childNodes(paths: string[], depth: number): FileTreeNode[] {
  const directories = new Map<string, string[]>();
  const files: FileTreeNode[] = [];
  for (const path of paths) {
    const segments = segmentsOf(path);
    const name = segments[depth];
    if (segments.length === depth + 1) {
      files.push(fileNode(path, name));
    } else {
      directories.set(name, [...(directories.get(name) ?? []), path]);
    }
  }
  const directoryNodes = [...directories].map(([name, members]) =>
    directoryNode(name, members, depth),
  );
  return [...directoryNodes.sort(byName), ...files.sort(byName)];
}

export function buildFileTree(paths: string[]): FileTreeNode[] {
  return childNodes(paths, 0);
}

export function filterPaths(paths: string[], query: string): string[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return paths;
  return paths.filter((path) => {
    const lowered = path.toLowerCase();
    return words.every((word) => lowered.includes(word));
  });
}
