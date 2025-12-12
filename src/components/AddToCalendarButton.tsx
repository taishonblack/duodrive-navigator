import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, Download, ExternalLink } from "lucide-react";
import { CalendarEvent, downloadICalFile, addToGoogleCalendar } from "@/lib/calendarExport";

interface AddToCalendarButtonProps {
  event: CalendarEvent;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function AddToCalendarButton({ 
  event, 
  variant = "outline", 
  size = "sm",
  className 
}: AddToCalendarButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleGoogleCalendar = () => {
    addToGoogleCalendar(event);
    setIsOpen(false);
  };

  const handleICalDownload = () => {
    downloadICalFile(event);
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Calendar className="h-4 w-4 mr-2" />
          Add to Calendar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleGoogleCalendar} className="cursor-pointer">
          <ExternalLink className="h-4 w-4 mr-2" />
          Google Calendar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleICalDownload} className="cursor-pointer">
          <Download className="h-4 w-4 mr-2" />
          Download iCal (.ics)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
