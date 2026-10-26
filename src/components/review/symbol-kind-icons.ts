import {
  AtSign,
  Box,
  Braces,
  CircleDot,
  Hash,
  ListOrdered,
  type LucideIcon,
  Package,
  Shapes,
  SquareFunction,
  Type,
  Variable,
} from "lucide-react";
import type { SymbolKind } from "@/lib/types";

export const KIND_ICONS: Record<SymbolKind, LucideIcon> = {
  function: SquareFunction,
  method: Braces,
  class: Box,
  interface: Shapes,
  type: Type,
  enum: ListOrdered,
  variable: Variable,
  constant: Hash,
  parameter: AtSign,
  property: CircleDot,
  module: Package,
};
