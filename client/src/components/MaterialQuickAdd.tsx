"use client";

import React from "react";
import { motion } from "framer-motion";
import { Package, Plus, Boxes, Truck, Hammer, TreePine, BrickWall, CircleDot, Trash2, Droplets, Layers, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuickMaterial {
  name: string;
  unit: string;
  icon: React.ReactNode;
  color: string;
  commonQuantities: number[];
}

export const quickMaterials: QuickMaterial[] = [
  {
    name: "Cement",
    unit: "bags",
    icon: <BrickWall className="w-5 h-5" />,
    color: "bg-gray-500",
    commonQuantities: [10, 25, 50],
  },
  {
    name: "Bricks",
    unit: "units",
    icon: <Boxes className="w-5 h-5" />,
    color: "bg-orange-600",
    commonQuantities: [500, 1000, 2000],
  },
  {
    name: "Sand",
    unit: "tonnes",
    icon: <Layers className="w-5 h-5" />,
    color: "bg-amber-400",
    commonQuantities: [2, 5, 10],
  },
  {
    name: "Rebar",
    unit: "pieces",
    icon: <CircleDot className="w-5 h-5" />,
    color: "bg-slate-600",
    commonQuantities: [20, 50, 100],
  },
  {
    name: "Timber",
    unit: "pieces",
    icon: <TreePine className="w-5 h-5" />,
    color: "bg-amber-700",
    commonQuantities: [10, 25, 50],
  },
  {
    name: "Roofing Sheets",
    unit: "sheets",
    icon: <Layers className="w-5 h-5" />,
    color: "bg-zinc-500",
    commonQuantities: [20, 50, 100],
  },
  {
    name: "Nails",
    unit: "kg",
    icon: <CircleDot className="w-5 h-5" />,
    color: "bg-slate-400",
    commonQuantities: [5, 10, 25],
  },
  {
    name: "Paint",
    unit: "litres",
    icon: <Droplets className="w-5 h-5" />,
    color: "bg-blue-500",
    commonQuantities: [10, 20, 50],
  },
  {
    name: "Tiles",
    unit: "boxes",
    icon: <Grid3X3 className="w-5 h-5" />,
    color: "bg-stone-400",
    commonQuantities: [10, 25, 50],
  },
  {
    name: "Wire",
    unit: "rolls",
    icon: <CircleDot className="w-5 h-5" />,
    color: "bg-copper-500",
    commonQuantities: [2, 5, 10],
  },
];

// Grid icon component
function Grid3X3({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

interface MaterialQuickAddProps {
  onSelect: (material: QuickMaterial, quantity: number, type: "purchase" | "usage") => void;
  className?: string;
}

export function MaterialQuickAdd({ onSelect, className = "" }: MaterialQuickAddProps) {
  const [selectedMaterial, setSelectedMaterial] = React.useState<QuickMaterial | null>(null);

  return (
    <div className={cn("space-y-4", className)}>
      <h4 className="text-sm font-medium text-muted-foreground">Quick Add Common Materials</h4>
      
      <div className="grid grid-cols-5 sm:grid-cols-5 gap-2">
        {quickMaterials.map((material, index) => (
          <motion.button
            key={material.name}
            onClick={() => setSelectedMaterial(material)}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.03 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "flex flex-col items-center gap-2 p-3 rounded-xl border transition-colors",
              selectedMaterial?.name === material.name
                ? "border-[#00bcd4] bg-[#00bcd4]/10"
                : "border-border bg-card hover:bg-muted"
            )}
          >
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-white", material.color)}>
              {material.icon}
            </div>
            <span className="text-xs font-medium text-center">{material.name}</span>
          </motion.button>
        ))}
      </div>

      {/* Quantity selector when material is selected */}
      {selectedMaterial && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="p-4 rounded-xl border border-border bg-muted/30"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium">{selectedMaterial.name}</span>
            <button
              onClick={() => setSelectedMaterial(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>

          <div className="text-xs text-muted-foreground mb-2">
            Quick select quantity ({selectedMaterial.unit}):
          </div>

          <div className="flex gap-2 flex-wrap mb-4">
            {selectedMaterial.commonQuantities.map((qty) => (
              <div key={qty} className="flex gap-1">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onSelect(selectedMaterial, qty, "purchase")}
                  className="px-3 py-1.5 text-sm rounded-lg bg-[#00bcd4]/10 text-[#00bcd4] hover:bg-[#00bcd4]/20 font-medium"
                >
                  +{qty}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onSelect(selectedMaterial, qty, "usage")}
                  className="px-3 py-1.5 text-sm rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 font-medium"
                >
                  -{qty}
                </motion.button>
              </div>
            ))}
          </div>

          <div className="text-xs text-muted-foreground">
            Green = Received (adds to stock) · Orange = Used (removes from stock)
          </div>
        </motion.div>
      )}
    </div>
  );
}
