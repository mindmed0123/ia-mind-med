import { Button } from "./button";
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

// Premium gradient button for CTAs
export const PremiumButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }
>(({ className, children, ...props }, ref) => (
  <Button
    ref={ref}
    className={cn(
      "gradient-primary shadow-medium hover:shadow-large",
      "transition-smooth hover:scale-105",
      "text-base font-semibold px-8 py-6 h-auto",
      className
    )}
    {...props}
  >
    {children}
  </Button>
));

PremiumButton.displayName = "PremiumButton";

// Outline premium button for secondary CTAs
export const OutlinePremiumButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }
>(({ className, children, ...props }, ref) => (
  <Button
    ref={ref}
    variant="outline"
    className={cn(
      "border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground",
      "transition-smooth hover:scale-105 shadow-soft",
      "text-base font-semibold px-8 py-6 h-auto",
      className
    )}
    {...props}
  >
    {children}
  </Button>
));

OutlinePremiumButton.displayName = "OutlinePremiumButton";
