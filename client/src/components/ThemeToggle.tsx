import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/ThemeContext";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, toggleTheme, isDark } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="outline" size="icon" className="w-9 h-9">
        <div className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="w-9 h-9 dark:hover:bg-zinc-700 hover:bg-slate-200 dark:text-zinc-300 text-slate-600 transition-colors duration-200"
        >
          {isDark ? (
            <Sun className="h-[1.2rem] w-[1.2rem]" />
          ) : (
            <Moon className="h-[1.2rem] w-[1.2rem]" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="dark:bg-zinc-900 dark:border-zinc-700 bg-white border-slate-200">
        <DropdownMenuItem
          onClick={() => theme !== "light" && toggleTheme()}
          className="dark:text-zinc-200 text-slate-800 dark:focus:bg-zinc-800 focus:bg-slate-100"
        >
          Light
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => theme !== "dark" && toggleTheme()}
          className="dark:text-zinc-200 text-slate-800 dark:focus:bg-zinc-800 focus:bg-slate-100"
        >
          Dark
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

