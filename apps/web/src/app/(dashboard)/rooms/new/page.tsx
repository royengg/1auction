"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, X, Loader2, Gavel } from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
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
          <Button asChild className="mt-4">
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
    <div className="p-6 lg:p-8">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Create New Auction
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up your auction room with items, budget, and bidding rules.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-8">
        {/* Event Details */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
            Event Details
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Auction Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Rare Vintage Watches"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Event Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your auction event…"
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="budget">Per-Room Budget ($)</Label>
                <Input
                  id="budget"
                  type="number"
                  min="1"
                  value={perRoomBudget}
                  onChange={(e) => setPerRoomBudget(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="increment">Minimum Increment ($)</Label>
                <Input
                  id="increment"
                  type="number"
                  min="1"
                  value={minIncrement}
                  onChange={(e) => setMinIncrement(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Item Duration (seconds)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  value={itemDuration}
                  onChange={(e) => setItemDuration(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxBidders">Max Bidders</Label>
                <Input
                  id="maxBidders"
                  type="number"
                  min="2"
                  max="6"
                  value={maxBidders}
                  onChange={(e) => setMaxBidders(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Inventory List */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Inventory List
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addItem}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Item
            </Button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div
                key={index}
                className="rounded-md border border-border bg-background p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-xs uppercase text-muted-foreground">
                    Lot {String(index + 1).padStart(2, "0")}
                  </span>
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`item-name-${index}`}>Item Name</Label>
                    <Input
                      id={`item-name-${index}`}
                      value={item.name}
                      onChange={(e) =>
                        updateItem(index, "name", e.target.value)
                      }
                      placeholder="e.g. Rolex Submariner 1968"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`item-price-${index}`}>
                      Starting Price ($)
                    </Label>
                    <Input
                      id={`item-price-${index}`}
                      type="number"
                      min="0"
                      value={item.startingPrice}
                      onChange={(e) =>
                        updateItem(index, "startingPrice", e.target.value)
                      }
                      placeholder="0"
                      required
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <Label htmlFor={`item-desc-${index}`}>Description</Label>
                  <Textarea
                    id={`item-desc-${index}`}
                    value={item.description}
                    onChange={(e) =>
                      updateItem(index, "description", e.target.value)
                    }
                    placeholder="Item condition, provenance, notable details…"
                    rows={2}
                  />
                </div>

                <div className="mt-4 space-y-2">
                  <Label htmlFor={`item-image-${index}`}>Image URL</Label>
                  <Input
                    id={`item-image-${index}`}
                    type="url"
                    value={item.imageUrl}
                    onChange={(e) =>
                      updateItem(index, "imageUrl", e.target.value)
                    }
                    placeholder="https://example.com/item-image.jpg"
                  />
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full"
            onClick={addItem}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Another Item
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Separator />

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…
              </>
            ) : (
              <>
                <Gavel className="mr-2 h-4 w-4" />
                Create Auction
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}