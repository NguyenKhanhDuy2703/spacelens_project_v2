import React from 'react';
import { AlertTriangle, Trash2, MapPin, Tag, Hash } from 'lucide-react';
import { Camera } from '@/types/camera.types';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Alert, AlertIcon, AlertContent, AlertDescription } from '@/components/ui/alert';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  camera: Camera | null;
  onConfirm: (id: string) => void;
  isLoading?: boolean;
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  camera,
  onConfirm,
  isLoading = false,
}: DeleteConfirmModalProps): React.JSX.Element {
  return (
    <AlertDialog open={isOpen && !!camera} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-lg w-full mx-4">
        <AlertDialogHeader>
          {/* Title row */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-950/70 border border-red-800/60 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-red-400" />
            </div>
            <div>
              <AlertDialogTitle className="text-red-400 text-base">
                Delete Camera Endpoint
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-500 text-xs mt-0.5">
                This action is permanent and cannot be undone.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        {/* Camera info card */}
        {camera && (
          <div className="mt-4 rounded-lg bg-slate-900/70 border border-slate-800 divide-y divide-slate-800/80">
            <div className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Hash size={11} />
                <span>Name</span>
              </div>
              <span className="text-sm font-semibold text-slate-100">{camera.name}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Tag size={11} />
                <span>Code</span>
              </div>
              <code className="text-xs font-mono text-cyan-400 bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-900/40">
                {camera.camera_code}
              </code>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <MapPin size={11} />
                <span>Location</span>
              </div>
              <span className="text-xs text-slate-300 max-w-[220px] text-right truncate" title={camera.location_id}>
                {camera.location_id}
              </span>
            </div>
          </div>
        )}

        {/* Warning alert */}
        <Alert variant="destructive" className="mt-4">
          <AlertIcon>
            <AlertTriangle size={14} className="text-red-400" />
          </AlertIcon>
          <AlertContent>
            <AlertDescription className="text-red-300 font-mono text-[11px] leading-relaxed">
              WARNING: This will terminate any active AI inference process and decouple all zone polygons assigned to this device.
            </AlertDescription>
          </AlertContent>
        </Alert>

        <AlertDialogFooter className="mt-5">
          <AlertDialogCancel onClick={onClose} disabled={isLoading}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isLoading || !camera}
            onClick={() => camera && onConfirm(camera._id)}
          >
            <Trash2 size={14} />
            {isLoading ? 'Deleting...' : 'Delete Camera'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
