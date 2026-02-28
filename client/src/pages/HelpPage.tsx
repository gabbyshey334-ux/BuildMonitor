"use client";

import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, ListOrdered, HelpCircle } from "lucide-react";

const WHATSAPP_JOIN = "+1 415 523 8886";
const JOIN_CODE = "join thick-tea";

const COMMANDS = [
  { say: "Bought 50 bags cement for 1,900,000", happens: "Logs expense" },
  { say: "Used 5 bags cement", happens: "Updates inventory" },
  { say: "6 workers on site today", happens: "Logs daily activity" },
  { say: "Foundation 80% complete", happens: "Updates progress" },
  { say: "How much have we spent?", happens: "Budget summary" },
  { say: "How much cement do we have?", happens: "Inventory check" },
  { say: "Heavy rain, no work today", happens: "Logs delay" },
  { say: "Switch project", happens: "Change active project" },
  { say: "Send receipt photo", happens: "OCR scan" },
  { say: "Send voice note", happens: "Transcribe & log" },
];

export default function HelpPage() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <h1 className="font-heading text-2xl font-bold dark:text-white text-slate-800 mb-8">
          Help & How To Use
        </h1>

        {/* How To Use */}
        <Card className="mb-8 dark:bg-zinc-900/80 dark:border-zinc-800/50 bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="dark:text-white text-slate-800 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-[#22c55e]" />
              How To Use JengaTrack
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 dark:text-zinc-300 text-slate-600">
            <ol className="list-decimal list-inside space-y-3 text-sm">
              <li>
                Save our WhatsApp number:{" "}
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
                Send &quot;{JOIN_CODE}&quot; to join the sandbox and get started
              </li>
              <li>Text expenses, materials, and daily updates in plain language</li>
              <li>Send receipt photos for automatic OCR scanning</li>
              <li>Send voice notes for transcription and logging</li>
              <li>Use commands like &quot;How much have we spent?&quot; for budget summaries</li>
            </ol>
            <div className="pt-2 dark:text-zinc-400 text-slate-500 text-sm">
              <strong className="dark:text-zinc-300 text-slate-700">WhatsApp number to message:</strong>{" "}
              <a
                href={`https://wa.me/${WHATSAPP_JOIN.replace(/\s/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#22c55e] hover:underline"
              >
                {WHATSAPP_JOIN}
              </a>
              <br />
              <strong className="dark:text-zinc-300 text-slate-700">Join code for sandbox:</strong>{" "}
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
              WhatsApp Commands Reference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border dark:border-zinc-700/50 border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-zinc-700/50 dark:bg-zinc-800/50 border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 dark:text-zinc-300 text-slate-700 font-medium">
                      What to say
                    </th>
                    <th className="text-left px-4 py-3 dark:text-zinc-300 text-slate-700 font-medium">
                      What happens
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
                      <td className="px-4 py-3">{row.happens}</td>
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
              FAQ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="dark:text-zinc-300 text-slate-700 font-medium mb-1">
                How do I add my manager to track updates?
              </p>
              <p className="dark:text-zinc-400 text-slate-600 text-sm">
                Share the WhatsApp number with your manager. They just start
                texting and the bot handles the rest.
              </p>
            </div>
            <div>
              <p className="dark:text-zinc-300 text-slate-700 font-medium mb-1">
                How often does the dashboard update?
              </p>
              <p className="dark:text-zinc-400 text-slate-600 text-sm">
                Every 30 seconds automatically.
              </p>
            </div>
            <div>
              <p className="dark:text-zinc-300 text-slate-700 font-medium mb-1">
                Can I use voice notes?
              </p>
              <p className="dark:text-zinc-400 text-slate-600 text-sm">
                Yes! Send any voice note and the bot will transcribe and process
                it.
              </p>
            </div>
            <div>
              <p className="dark:text-zinc-300 text-slate-700 font-medium mb-1">
                What currencies are supported?
              </p>
              <p className="dark:text-zinc-400 text-slate-600 text-sm">
                UGX (Uganda), KES (Kenya), NGN (Nigeria). Receipt photos
                auto-convert to UGX.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
