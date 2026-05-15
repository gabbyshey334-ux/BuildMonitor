import { getPasswordChecks } from "@shared/passwordPolicy.js";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

interface PasswordRequirementsProps {
  password: string;
  className?: string;
}

export function PasswordRequirements({ password, className }: PasswordRequirementsProps) {
  const { t } = useLanguage();
  const checks = getPasswordChecks(password);

  const items = [
    { key: "length", met: checks.length, label: t("auth.password.requirement.length") },
    { key: "lowercase", met: checks.lowercase, label: t("auth.password.requirement.lowercase") },
    { key: "uppercase", met: checks.uppercase, label: t("auth.password.requirement.uppercase") },
    { key: "digit", met: checks.digit, label: t("auth.password.requirement.digit") },
    { key: "symbol", met: checks.symbol, label: t("auth.password.requirement.symbol") },
  ] as const;

  return (
    <ul className={cn("space-y-1", className)} aria-live="polite">
      {items.map((item) => (
        <li
          key={item.key}
          className={cn(
            "flex items-center gap-2 text-xs",
            item.met ? "text-[#1E7A3E]" : "text-gray-500",
          )}
        >
          {item.met ? (
            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <X className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
          )}
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
