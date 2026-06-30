"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, X, Loader2, ImagePlus } from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AUCTION_BID, AUCTION_TIMER } from "@auction/shared";

interface ItemDraft {
 name: string;
 description: string;
 imageUrl: string;
 startingPrice: string;
}

function emptyItem(): ItemDraft {
 return { name: "", description: "", imageUrl: "", startingPrice: "" };
}

export default function CreateAuctionPage() {
 const router = useRouter();
 const { role, loading: roleLoading } = useRole();

 const [title, setTitle] = useState("");
 const [description, setDescription] = useState("");
 const [startDate, setStartDate] = useState("");
 const [perRoomBudget, setPerRoomBudget] = useState(
  String(AUCTION_BID.DEFAULT_PER_ROOM_BUDGET),
 );
 const [minIncrement, setMinIncrement] = useState(
  String(AUCTION_BID.DEFAULT_MIN_INCREMENT),
 );
 const [itemDuration, setItemDuration] = useState(
  String(AUCTION_TIMER.DEFAULT_DURATION_SECONDS),
 );
 const [maxBidders, setMaxBidders] = useState("6");
 const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 if (roleLoading) return null;
 if (role !== "AUCTIONEER") {
  return (
   <div className="flex min-h-[60vh] items-center justify-center p-6 text-center">
    <div>
     <h1 className="font-display text-xl font-bold text-foreground">
      Auctioneer access required
     </h1>
     <p className="mt-1 text-sm text-muted-foreground">
      Switch to the Auctioneer role to create auctions.
     </p>
     <Button asChild className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90">
      <Link href="/dashboard">Back to Dashboard</Link>
     </Button>
    </div>
   </div>
  );
 }

 function updateItem(index: number, field: keyof ItemDraft, value: string) {
  setItems((prev) =>
   prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
  );
 }

 function addItem() {
  setItems((prev) => [...prev, emptyItem()]);
 }

 function removeItem(index: number) {
  setItems((prev) => prev.filter((_, i) => i !== index));
 }

 async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setError(null);

  if (!title.trim()) {
   setError("Auction title is required.");
   return;
  }

  if (items.length === 0) {
   setError("At least one item is required.");
   return;
  }

  for (let i = 0; i < items.length; i++) {
   const item = items[i];
   if (item && !item.name.trim()) {
    setError(`Item ${i + 1}: name is required.`);
    return;
   }
  }

  setSubmitting(true);
  try {
   const room = await apiClient.createRoom({
    title: title.trim(),
    description: description.trim(),
    perRoomBudget: Number(perRoomBudget),
    minIncrement: Number(minIncrement),
    itemDurationSeconds: Number(itemDuration),
    maxBidders: Number(maxBidders),
    items: items.map((item) => ({
     name: item.name.trim(),
     description: item.description.trim(),
     imageUrl: item.imageUrl.trim() || null,
     startingPrice: Number(item.startingPrice) || 0,
    })),
   });
   router.push(`/rooms/${room.id}/lobby`);
  } catch (err) {
   setError(
    err instanceof Error ? err.message : "Failed to create auction.",
   );
  } finally {
   setSubmitting(false);
  }
 }

 return (
  <div className="p-6 lg:p-10">
   {/* Back link */}
   <Link
    href="/dashboard"
    className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
   >
    <ArrowLeft className="h-4 w-4" />
    Back to Dashboard
   </Link>

    {/* Header */}
    <div className="mb-10 text-center">
     <h1 className="font-display text-4xl font-bold text-foreground">
      Create Auction
     </h1>
     <p className="mt-2 text-sm text-muted-foreground">
      Define the core details and catalogue items for your upcoming event.
     </p>
    </div>

   <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-10">
    {/* Section 1: Event Details */}
    <div>
     <h2 className="mb-6 font-display text-lg font-semibold text-foreground">
      1. Event Details
     </h2>
     <div className="space-y-6">
      <div className="space-y-2">
       <Label htmlFor="title" className="font-mono text-xs uppercase tracking-wider">
        Auction Title
       </Label>
       <Input
        id="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Mid-Century Teak Sideboard"
        required
        className="border border-border bg-card text-sm"
       />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
       <div className="space-y-2">
        <Label htmlFor="startDate" className="font-mono text-xs uppercase tracking-wider">
         Start Date & Time
        </Label>
        <Input
         id="startDate"
         type="datetime-local"
         value={startDate}
         onChange={(e) => setStartDate(e.target.value)}
         className="border border-border bg-card text-sm"
        />
       </div>
       <div className="space-y-2">
        <Label htmlFor="budget" className="font-mono text-xs uppercase tracking-wider">
         Per-Room Budget ($)
        </Label>
        <Input
         id="budget"
         type="number"
         min="1"
         value={perRoomBudget}
         onChange={(e) => setPerRoomBudget(e.target.value)}
         required
         className="border border-border bg-card text-sm"
        />
       </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
       <div className="space-y-2">
        <Label htmlFor="increment" className="font-mono text-xs uppercase tracking-wider">
         Minimum Increment ($)
        </Label>
        <Input
         id="increment"
         type="number"
         min="1"
         value={minIncrement}
         onChange={(e) => setMinIncrement(e.target.value)}
         required
         className="border border-border bg-card text-sm"
        />
       </div>
       <div className="space-y-2">
        <Label htmlFor="duration" className="font-mono text-xs uppercase tracking-wider">
         Item Duration (seconds)
        </Label>
        <Input
         id="duration"
         type="number"
         min="1"
         value={itemDuration}
         onChange={(e) => setItemDuration(e.target.value)}
         required
         className="border border-border bg-card text-sm"
        />
       </div>
       <div className="space-y-2">
        <Label htmlFor="maxBidders" className="font-mono text-xs uppercase tracking-wider">
         Max Bidders
        </Label>
        <Input
         id="maxBidders"
         type="number"
         min="2"
         max="6"
         value={maxBidders}
         onChange={(e) => setMaxBidders(e.target.value)}
         required
         className="border border-border bg-card text-sm"
        />
       </div>
      </div>
     </div>
    </div>

    {/* Section 2: Catalogue Items */}
    <div>
     <div className="mb-6 flex items-center justify-between">
      <h2 className="font-display text-lg font-semibold text-foreground">
       2. Catalogue Items
      </h2>
      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
       Lot {String(items.length).padStart(2, "0")}
      </span>
     </div>

     <div className="space-y-6">
      {items.map((item, index) => (
       <div
        key={index}
        className="border border-border bg-card p-6"
       >
        <div className="mb-4 flex items-center justify-end">
         {items.length > 1 && (
          <button
           type="button"
           onClick={() => removeItem(index)}
           className="text-muted-foreground transition-colors hover:text-destructive"
          >
           <X className="h-4 w-4" />
          </button>
         )}
        </div>

        <div className="grid gap-6 sm:grid-cols-[200px_1fr]">
         {/* Image upload placeholder */}
         <div className="flex h-[200px] items-center justify-center border border-dashed border-border bg-muted">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
           <ImagePlus className="h-8 w-8" />
           <span className="font-mono text-xs uppercase tracking-wider">
            Upload Image
           </span>
          </div>
         </div>

         <div className="space-y-4">
          <div className="space-y-2">
           <Label htmlFor={`item-name-${index}`} className="font-mono text-xs uppercase tracking-wider">
            Item Name
           </Label>
           <Input
            id={`item-name-${index}`}
            value={item.name}
            onChange={(e) =>
             updateItem(index, "name", e.target.value)
            }
            placeholder="e.g. Mid-Century Teak Sideboard"
            required
            className="border border-border bg-card text-sm"
           />
          </div>

          <div className="space-y-2">
           <Label htmlFor={`item-desc-${index}`} className="font-mono text-xs uppercase tracking-wider">
            Description
           </Label>
           <Textarea
            id={`item-desc-${index}`}
            value={item.description}
            onChange={(e) =>
             updateItem(index, "description", e.target.value)
            }
            placeholder="Condition, dimensions, provenance..."
            rows={3}
            className="border border-border bg-card text-sm resize-none"
           />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
           <div className="space-y-2">
            <Label htmlFor={`item-price-${index}`} className="font-mono text-xs uppercase tracking-wider">
             Starting Bid ($)
            </Label>
            <Input
             id={`item-price-${index}`}
             type="number"
             min="0"
             value={item.startingPrice}
             onChange={(e) =>
              updateItem(index, "startingPrice", e.target.value)
             }
             placeholder="0.00"
             required
             className="border border-border bg-card text-sm"
            />
           </div>
           <div className="space-y-2">
            <Label htmlFor={`item-image-${index}`} className="font-mono text-xs uppercase tracking-wider">
             Image URL
            </Label>
            <Input
             id={`item-image-${index}`}
             type="url"
             value={item.imageUrl}
             onChange={(e) =>
              updateItem(index, "imageUrl", e.target.value)
             }
             placeholder="https://..."
             className="border border-border bg-card text-sm"
            />
           </div>
          </div>
         </div>
        </div>
       </div>
      ))}
     </div>

     <button
      type="button"
      onClick={addItem}
      className="mt-4 flex w-full items-center justify-center gap-2 border border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
     >
      <Plus className="h-4 w-4" />
      <span className="font-mono text-xs uppercase tracking-wider">
       Add Another Lot
      </span>
     </button>
    </div>

    {error && (
     <Alert variant="destructive" className="">
      <AlertDescription>{error}</AlertDescription>
     </Alert>
    )}

    {/* Actions */}
    <div className="flex items-center justify-end gap-3 pb-10">
     <Button
      type="button"
      variant="outline"
      onClick={() => router.push("/dashboard")}
      className="border-foreground bg-transparent px-8"
     >
      SAVE DRAFT
     </Button>
     <Button
      type="submit"
      disabled={submitting}
      className="bg-primary px-8 text-primary-foreground hover:bg-primary/90"
     >
      {submitting ? (
       <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…
       </>
      ) : (
       "START AUCTION"
      )}
     </Button>
    </div>
   </form>
  </div>
 );
}
