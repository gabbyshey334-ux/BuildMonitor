"use client";

import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, ListOrdered, HelpCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const WHATSAPP_JOIN = "+1 415 523 8886";
const JOIN_CODE = "join thick-tea";

const COMMANDS = [
  { say: "Bought 50 bags cement for 1,900,000", happensKey: "help.cmdExpense" },
  { say: "Used 5 bags cement", happensKey: "help.cmdInventory" },
  { say: "6 workers on site today", happensKey: "help.cmdDaily" },
  { say: "Foundation 80% complete", happensKey: "help.cmdProgress" },
  { say: "How much have we spent?", happensKey: "help.cmdBudget" },
  { say: "How much cement do we have?", happensKey: "help.cmdInventoryCheck" },
  { say: "Heavy rain, no work today", happensKey: "help.cmdDelay" },
  { say: "Switch project", happensKey: "help.cmdSwitch" },
  { say: "Send receipt photo", happensKey: "help.cmdOCR" },
  { say: "Send voice note", happensKey: "help.cmdVoice" },
];

export default function HelpPage() {
  const { t } = useLanguage();
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <h1 className="font-heading text-2xl font-bold dark:text-white text-slate-800 mb-8">
          {t("help.howToUseTitle")}
        </h1>

        {/* How To Use */}
        <Card className="mb-8 dark:bg-zinc-900/80 dark:border-zinc-800/50 bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="dark:text-white text-slate-800 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-[#22c55e]" />
              {t("help.howToUseJenga")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 dark:text-zinc-300 text-slate-600">
            <ol className="list-decimal list-inside space-y-3 text-sm">
              <li>
                {t("help.saveNumber")}{" "}
                <a
                  href={`https://wa.me/${WHATSAPP_JOIN.replace(/\s/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#22c55e] hover:underline"
                >
                  {WHATSAPP_JOIN}
                </a>
              </li>
              <li>
                {t("help.sendJoin").replace("{code}", JOIN_CODE)}
              </li>
              <li>{t("help.textUpdates")}</li>
              <li>{t("help.receiptPhotos")}</li>
              <li>{t("help.voiceNotes")}</li>
              <li>{t("help.commandsLike")}</li>
            </ol>
            <div className="pt-2 dark:text-zinc-400 text-slate-500 text-sm">
              <strong className="dark:text-zinc-300 text-slate-700">{t("help.whatsappLabel")}</strong>{" "}
              <a
                href={`https://wa.me/${WHATSAPP_JOIN.replace(/\s/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#22c55e] hover:underline"
              >
                {WHATSAPP_JOIN}
              </a>
              <br />
              <strong className="dark:text-zinc-300 text-slate-700">{t("help.joinCodeLabel")}</strong>{" "}
              <code className="dark:bg-zinc-800 bg-slate-100 px-1.5 py-0.5 rounded text-[#14b8a6]">
                {JOIN_CODE}
              </code>
            </div>
          </CardContent>
        </Card>

        {/* Commands Reference */}
        <Card className="mb-8 dark:bg-zinc-900/80 dark:border-zinc-800/50 bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="dark:text-white text-slate-800 flex items-center gap-2">
              <ListOrdered className="h-5 w-5 text-[#14b8a6]" />
              {t("help.commandsRefTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border dark:border-zinc-700/50 border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-zinc-700/50 dark:bg-zinc-800/50 border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 dark:text-zinc-300 text-slate-700 font-medium">
                      {t("help.whatToSay")}
                    </th>
                    <th className="text-left px-4 py-3 dark:text-zinc-300 text-slate-700 font-medium">
                      {t("help.whatHappens")}
                    </th>
                  </tr>
                </thead>
                <tbody className="dark:text-zinc-400 text-slate-600">
                  {COMMANDS.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b dark:border-zinc-800/50 border-slate-100 last:border-0 dark:hover:bg-zinc-800/30 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 dark:text-zinc-200 text-slate-800">&quot;{row.say}&quot;</td>
                      <td className="px-4 py-3">{t(row.happensKey)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card className="dark:bg-zinc-900/80 dark:border-zinc-800/50 bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="dark:text-white text-slate-800 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-[#22c55e]" />
              {t("help.faq")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="dark:text-zinc-300 text-slate-700 font-medium mb-1">
                {t("help.faqAddManager")}
              </p>
              <p className="dark:text-zinc-400 text-slate-600 text-sm">
                {t("help.faqAddManagerAns")}
              </p>
            </div>
            <div>
              <p className="dark:text-zinc-300 text-slate-700 font-medium mb-1">
                {t("help.faqDashboard")}
              </p>
              <p className="dark:text-zinc-400 text-slate-600 text-sm">
                {t("help.faqDashboardAns")}
              </p>
            </div>
            <div>
              <p className="dark:text-zinc-300 text-slate-700 font-medium mb-1">
                {t("help.faqVoice")}
              </p>
              <p className="dark:text-zinc-400 text-slate-600 text-sm">
                {t("help.faqVoiceAns")}
              </p>
            </div>
            <div>
              <p className="dark:text-zinc-300 text-slate-700 font-medium mb-1">
                {t("help.faqCurrencies")}
              </p>
              <p className="dark:text-zinc-400 text-slate-600 text-sm">
                {t("help.faqCurrenciesAns")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
