import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Plus, X, FileText, Clock, Shield, AlertCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useTechnicianNotes, useAddNote, useDeleteNote } from "@/hooks/useTechnicianSkills";
import { NoteType } from "@/types/technician";
import { useAuth } from "@/contexts/AuthContext";

interface TechnicianNotesSectionProps {
  profileId: string;
  isEditable?: boolean;
}

const NOTE_TYPE_CONFIG: Record<NoteType, { 
  label: string; 
  description: string;
  icon: typeof Clock;
  badgeClass: string;
}> = {
  scheduling: { 
    label: "Scheduling", 
    description: "Time preferences, availability patterns",
    icon: Clock,
    badgeClass: "bg-primary/10 text-primary border-primary/20"
  },
  skill: { 
    label: "Skill", 
    description: "Special abilities, certifications, expertise",
    icon: Shield,
    badgeClass: "bg-success/10 text-success border-success/20"
  },
  restriction: { 
    label: "Restriction", 
    description: "Limitations, things to avoid",
    icon: AlertCircle,
    badgeClass: "bg-destructive/10 text-destructive border-destructive/20"
  },
  general: { 
    label: "General", 
    description: "Other relevant information",
    icon: MessageSquare,
    badgeClass: "bg-muted text-muted-foreground"
  },
};

export function TechnicianNotesSection({ profileId, isEditable = true }: TechnicianNotesSectionProps) {
  const { profile } = useAuth();
  const { data: notes, isLoading } = useTechnicianNotes(profileId);
  const addNote = useAddNote();
  const deleteNote = useDeleteNote();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [newNoteType, setNewNoteType] = useState<NoteType>("general");
  const [newNoteText, setNewNoteText] = useState("");

  const handleAddNote = () => {
    if (!newNoteText.trim()) return;

    addNote.mutate(
      {
        profileId,
        noteType: newNoteType,
        note: newNoteText.trim(),
        createdBy: profile?.id,
      },
      {
        onSuccess: () => {
          setIsAddDialogOpen(false);
          setNewNoteText("");
          setNewNoteType("general");
        },
      }
    );
  };

  const handleDeleteNote = () => {
    if (!deleteNoteId) return;

    deleteNote.mutate(
      { noteId: deleteNoteId, profileId },
      {
        onSuccess: () => setDeleteNoteId(null),
      }
    );
  };

  const getTypeConfig = (type: NoteType) => {
    return NOTE_TYPE_CONFIG[type] || NOTE_TYPE_CONFIG.general;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scheduling Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Scheduling Notes
            </CardTitle>
            <CardDescription>
              Notes to help the AI make better scheduling decisions
            </CardDescription>
          </div>
          {isEditable && (
            <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Note
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {notes && notes.length > 0 ? (
            <div className="space-y-3">
              {notes.map((note) => {
                const typeConfig = getTypeConfig(note.note_type);
                const TypeIcon = typeConfig.icon;
                
                return (
                  <div
                    key={note.id}
                    className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs gap-1", typeConfig.badgeClass)}
                        >
                          <TypeIcon className="h-3 w-3" />
                          {typeConfig.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm">{note.note}</p>
                    </div>
                    {isEditable && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteNoteId(note.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No scheduling notes yet</p>
              <p className="text-sm mt-1">
                Add notes to help the AI make better scheduling decisions.
              </p>
              {isEditable && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => setIsAddDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Note
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Note Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-background">
          <DialogHeader>
            <DialogTitle>Add Scheduling Note</DialogTitle>
            <DialogDescription>
              Add a note to help the AI make better scheduling decisions for this technician.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="note-type">Note Type</Label>
              <Select value={newNoteType} onValueChange={(v) => setNewNoteType(v as NoteType)}>
                <SelectTrigger id="note-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {Object.entries(NOTE_TYPE_CONFIG).map(([value, config]) => {
                    const Icon = config.icon;
                    return (
                      <SelectItem key={value} value={value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <div>
                            <span className="font-medium">{config.label}</span>
                            <span className="text-muted-foreground text-xs ml-2">
                              — {config.description}
                            </span>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {NOTE_TYPE_CONFIG[newNoteType].description}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-text">Note</Label>
              <Textarea
                id="note-text"
                placeholder="e.g., Prefers morning shifts, excellent with elderly customers"
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNote} disabled={!newNoteText.trim() || addNote.isPending}>
              {addNote.isPending ? "Saving..." : "Save Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteNoteId} onOpenChange={(open) => !open && setDeleteNoteId(null)}>
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteNote}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
