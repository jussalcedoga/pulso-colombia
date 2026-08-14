import {
  Banknote,
  Bed,
  Bus,
  CircleHelp,
  Cross,
  Droplets,
  HandHelping,
  Info,
  Package,
  ShowerHead,
  Soup,
  Stethoscope,
  Truck
} from "lucide-react";
import type { NeedType, OfferType } from "../types";

export function NeedIcon({ type, size = 16 }: { type: NeedType; size?: number }) {
  const props = { size, "aria-hidden": true as const };
  switch (type) {
    case "water":
      return <Droplets {...props} />;
    case "food":
      return <Soup {...props} />;
    case "shelter":
      return <Bed {...props} />;
    case "medical":
      return <Cross {...props} />;
    case "hygiene":
      return <ShowerHead {...props} />;
    case "rescue":
      return <HandHelping {...props} />;
    case "transport":
      return <Bus {...props} />;
    case "information":
      return <Info {...props} />;
    case "funds":
      return <Banknote {...props} />;
  }
}

export function OfferIcon({ type, size = 16 }: { type: OfferType; size?: number }) {
  const props = { size, "aria-hidden": true as const };
  switch (type) {
    case "supplies":
      return <Package {...props} />;
    case "transport":
      return <Truck {...props} />;
    case "shelter":
      return <Bed {...props} />;
    case "medical":
      return <Stethoscope {...props} />;
    case "volunteer":
      return <HandHelping {...props} />;
    case "funds":
      return <Banknote {...props} />;
    case "other":
      return <CircleHelp {...props} />;
  }
}
