"use client";

import { forwardRef, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useController, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Shown when no option matches `value` (e.g. an empty "Any…" choice). */
  placeholder?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  size?: "sm" | "md";
  className?: string;
  /** Adds a filter box; defaults to on for long lists. */
  searchable?: boolean;
  onBlur?: () => void;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

const SEARCH_THRESHOLD = 8;
const MENU_MAX_HEIGHT = 288;

// A themed replacement for <select>: native dropdowns render in the OS's light
// style, which clashes with the dark UI. Implements the ARIA "select-only
// combobox" pattern — arrows/Home/End move, Enter/Space pick, Esc closes, and
// typing jumps to the next matching option. The menu is portalled so cards
// with overflow-hidden can't clip it.
export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    value,
    onChange,
    options,
    placeholder = "Select...",
    id,
    name,
    disabled,
    invalid,
    size = "md",
    className,
    searchable,
    onBlur,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
  },
  ref
) {
  const autoId = useId();
  const buttonId = id ?? `select-${autoId}`;
  const listId = `${buttonId}-list`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typeahead = useRef({ text: "", at: 0 });

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState<{ left: number; width: number; top?: number; bottom?: number }>({ left: 0, width: 0 });

  const withSearch = searchable ?? options.length > SEARCH_THRESHOLD;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const selected = options.find((o) => o.value === value);

  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Open upwards when there isn't room below.
    const below = window.innerHeight - rect.bottom;
    const up = below < Math.min(MENU_MAX_HEIGHT, 200) && rect.top > below;
    setPosition(up ? { left: rect.left, width: rect.width, bottom: window.innerHeight - rect.top + 6 } : { left: rect.left, width: rect.width, top: rect.bottom + 6 });
  }, []);

  const openMenu = () => {
    if (disabled) return;
    place();
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const choose = (option?: SelectOption) => {
    if (!option || option.disabled) return;
    onChange(option.value);
    close();
  };

  useLayoutEffect(() => {
    if (!open) return;
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    if (withSearch) searchRef.current?.focus();
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, withSearch]);

  // Keep the highlighted option in view while arrowing through a long list.
  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  const move = (from: number, step: number) => {
    if (visible.length === 0) return -1;
    let i = from;
    for (let n = 0; n < visible.length; n++) {
      i = (i + step + visible.length) % visible.length;
      if (!visible[i].disabled) return i;
    }
    return from;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => move(a, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => move(a < 0 ? 0 : a, -1));
        break;
      case "Home":
        e.preventDefault();
        setActive(move(-1, 1));
        break;
      case "End":
        e.preventDefault();
        setActive(move(0, -1));
        break;
      case "Enter":
        e.preventDefault();
        choose(visible[active]);
        break;
      case " ":
        // A space is text in the search box.
        if (withSearch) return;
        e.preventDefault();
        choose(visible[active]);
        break;
      case "Escape":
        e.preventDefault();
        // Only close the menu — not a dialog the select sits in.
        e.stopPropagation();
        close();
        break;
      case "Tab":
        close(false);
        break;
      default:
        if (!withSearch && e.key.length === 1) {
          const now = Date.now();
          const t = typeahead.current;
          t.text = now - t.at > 600 ? e.key.toLowerCase() : t.text + e.key.toLowerCase();
          t.at = now;
          const start = t.text.length === 1 ? active + 1 : active;
          for (let n = 0; n < visible.length; n++) {
            const i = (start + n) % visible.length;
            if (!visible[i].disabled && visible[i].label.toLowerCase().startsWith(t.text)) {
              setActive(i);
              break;
            }
          }
        }
    }
  };

  const activeId = open && active >= 0 && visible[active] ? `${listId}-${active}` : undefined;

  return (
    <>
      <button
        ref={(node) => {
          triggerRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        id={buttonId}
        name={name}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={withSearch ? undefined : activeId}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        // The global :focus-visible outline isn't in a layer, so it beats Tailwind's outline-none;
        // the gold ring below is the focus indicator here.
        style={{ outline: "none" }}
        className={cn(
          "glass-input flex w-full items-center justify-between gap-2 text-left outline-none transition-colors",
          "hover:border-gold/40 focus-visible:border-gold/60 focus-visible:ring-2 focus-visible:ring-gold/25 disabled:cursor-not-allowed disabled:opacity-60",
          size === "sm" ? "h-9 px-3 text-xs" : "h-11 px-4 text-sm",
          open && "border-gold/60 ring-2 ring-gold/25",
          invalid && "border-danger/60",
          className
        )}
      >
        <span className={cn("truncate", !selected && "text-muted")}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180 text-gold")} aria-hidden />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", left: position.left, width: Math.max(position.width, 180), top: position.top, bottom: position.bottom }}
            className="z-[100] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-elevation"
          >
            {withSearch && (
              <div className="flex items-center gap-2 border-b border-border px-3 focus-within:bg-foreground/5">
                <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onKeyDown}
                  placeholder="Search..."
                  aria-label="Search options"
                  role="combobox"
                  aria-expanded
                  aria-controls={listId}
                  aria-activedescendant={activeId}
                  aria-autocomplete="list"
                  style={{ outline: "none" }}
                  className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted"
                />
              </div>
            )}
            <ul id={listId} role="listbox" aria-labelledby={buttonId} className="overflow-y-auto p-1" style={{ maxHeight: MENU_MAX_HEIGHT }}>
              {visible.length === 0 && <li className="px-3 py-2.5 text-sm text-muted">No matches</li>}
              {visible.map((option, i) => {
                const isSelected = option.value === value;
                return (
                  <li
                    key={option.value}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled || undefined}
                    onPointerMove={() => !option.disabled && setActive(i)}
                    onClick={() => choose(option)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm",
                      i === active && "bg-gold/10",
                      isSelected ? "font-medium text-gold" : "text-foreground",
                      option.disabled && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )}
    </>
  );
});

type FormSelectProps<T extends FieldValues> = Omit<SelectProps, "value" | "onChange" | "onBlur"> & {
  control: Control<T>;
  name: FieldPath<T>;
};

/** Select bound to a react-hook-form field (the drop-in for `<select {...register(name)}>`). */
export function FormSelect<T extends FieldValues>({ control, name, ...props }: FormSelectProps<T>) {
  const {
    field: { ref, name: fieldName, value, onChange, onBlur },
    fieldState: { error },
  } = useController({ control, name });
  return (
    <Select
      {...props}
      ref={ref}
      name={fieldName}
      value={value ?? ""}
      onChange={onChange}
      onBlur={onBlur}
      invalid={props.invalid ?? Boolean(error)}
    />
  );
}
