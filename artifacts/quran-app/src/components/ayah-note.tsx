import { useState, useRef, useEffect } from "react";
import { StickyNote } from "lucide-react";

interface Props {
  ayahKey: string;
  value: string;
  onChange: (text: string) => void;
}

export function AyahNote({ ayahKey, value, onChange }: Props) {
  const [open, setOpen] = useState(!!value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  // Auto-open when a saved note exists on mount
  useEffect(() => {
    if (value) setOpen(true);
  }, [ayahKey]);

  const handleToggle = () => {
    setOpen((prev) => !prev);
  };

  const hasNote = value.trim().length > 0;

  return (
    <div className="flex flex-col gap-1 pt-1 select-none" style={{ minWidth: 28 }}>
      <button
        onClick={handleToggle}
        title={hasNote ? "View/edit note" : "Add a note"}
        className={[
          "flex items-center justify-center w-7 h-7 rounded-md transition-colors",
          hasNote
            ? "text-amber-500 bg-amber-50 hover:bg-amber-100"
            : "text-muted-foreground hover:text-foreground hover:bg-muted",
        ].join(" ")}
      >
        <StickyNote size={15} />
      </button>

      {open && (
        <div className="mt-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Add a note for this ayah…"
            rows={2}
            className="w-full text-xs rounded-md border border-border bg-amber-50/60 px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
            style={{ minWidth: 120, maxWidth: 180 }}
          />
        </div>
      )}
    </div>
  );
}
