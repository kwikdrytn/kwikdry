import { useState } from "react";
import { format } from "date-fns";
import { Plus, Trash2, Calendar, Tag } from "lucide-react";
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

interface SchedulingNotesListProps {
  profileId: string;
}

const NOTE_TYPES: { value: NoteType; label: string; color: string }[] = [
  { value: "scheduling", label: "Scheduling", color: "bg-primary/10 text-primary" },
  { value: "skill", label: "Skill", color: "bg-success/10 text-success" },
  { value: "restriction", label: "Restriction", color: "bg-destructive/10 text-destructive" },
  { value: "general", label: "General", color: "bg-muted text-muted-foreground" },
];

export function SchedulingNotesList({ profileId }: SchedulingNotesListProps) {
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

  const getNoteTypeConfig = (type: NoteType) => {
    return NOTE_TYPES.find((t) => t.value === type) || NOTE_TYPES[3];
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
            <CardTitle>Scheduling Notes</CardTitle>
            <CardDescription>
              Free-form notes for scheduling considerations
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        </CardHeader>
        <CardContent>
          {notes && notes.length > 0 ? (
            <div className="space-y-3">
              {notes.map((note) => {
                const typeConfig = getNoteTypeConfig(note.note_type);
                return (
                  <div
                    key={note.id}
                    className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-card"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={cn("text-xs", typeConfig.color)}>
                          <Tag className="h-3 w-3 mr-1" />
                          {typeConfig.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(note.created_at), "MMM d, yyyy")}
                        </span>
                      </div>
                      <p className="text-sm">{note.note}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteNoteId(note.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No scheduling notes yet.</p>
              <p className="text-sm">Add notes to help with job assignments.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Note Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-background">
          <DialogHeader>
            <DialogTitle>Add Scheduling Note</DialogTitle>
            <DialogDescription>
              Add a note to help with job assignments for this technician.
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
                  {NOTE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-text">Note</Label>
              <Textarea
                id="note-text"
                placeholder="Enter note..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNote} disabled={!newNoteText.trim() || addNote.isPending}>
              {addNote.isPending ? "Adding..." : "Add Note"}
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
