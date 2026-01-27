/**
 * Settings Dialog (Placeholder)
 * 
 * Minimal settings component for MVP
 * Can be expanded with actual settings in the future
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-width-[425px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="py-6">
          <p className="text-sm text-muted-foreground text-center">
            Settings panel - Coming Soon
          </p>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Configure your preferences, notifications, and account settings.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

