"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, X, Loader2, ImagePlus, ChevronRight, ChevronLeft } from "lucide-react";

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

function getDefaultFormState() {
  return {
    title: "",
    description: "",
    startDate: "",
    perRoomBudget: String(AUCTION_BID.DEFAULT_PER_ROOM_BUDGET),
    minIncrement: String(AUCTION_BID.DEFAULT_MIN_INCREMENT),
    itemDuration: String(AUCTION_TIMER.DEFAULT_DURATION_SECONDS),
    maxBidders: "6",
    coverImageUrl: "",
    items: [emptyItem()],
  };
}

export default function CreateAuctionPage() {
  const router = useRouter();
  const { role, loading: roleLoading } = useRole();

  const [step, setStep] = useState<1 | 2>(1);

  const defaults = getDefaultFormState();
  const [title, setTitle] = useState(defaults.title);
  const [description, setDescription] = useState(defaults.description);
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [perRoomBudget, setPerRoomBudget] = useState(defaults.perRoomBudget);
  const [minIncrement, setMinIncrement] = useState(defaults.minIncrement);
  const [itemDuration, setItemDuration] = useState(defaults.itemDuration);
  const [maxBidders, setMaxBidders] = useState(defaults.maxBidders);
  const [coverImageUrl, setCoverImageUrl] = useState(defaults.coverImageUrl);
  const [items, setItems] = useState<ItemDraft[]>(defaults.items);

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

  function resetForm() {
    const d = getDefaultFormState();
    setTitle(d.title);
    setDescription(d.description);
    setStartDate(d.startDate);
    setPerRoomBudget(d.perRoomBudget);
    setMinIncrement(d.minIncrement);
    setItemDuration(d.itemDuration);
    setMaxBidders(d.maxBidders);
    setCoverImageUrl(d.coverImageUrl);
    setItems(d.items);
    setError(null);
    setStep(1);
  }

  function validateStep1(): string | null {
    if (!title.trim()) return "Auction title is required.";
    if (!perRoomBudget || Number(perRoomBudget) < 1) return "Per-room budget must be at least 1.";
    if (!minIncrement || Number(minIncrement) < 1) return "Minimum increment must be at least 1.";
    if (!itemDuration || Number(itemDuration) < 1) return "Item duration must be at least 1 second.";
    if (!maxBidders || Number(maxBidders) < 2) return "Max bidders must be at least 2.";
    return null;
  }

  function goToStep2() {
    setError(null);
    const validationError = validateStep1();
    if (validationError) {
      setError(validationError);
      return;
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToStep1() {
    setError(null);
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

    const step1Error = validateStep1();
    if (step1Error) {
      setError(step1Error);
      setStep(1);
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
        coverImageUrl: coverImageUrl.trim() || null,
        items: items.map((item) => ({
          name: item.name.trim(),
          description: item.description.trim(),
          imageUrl: item.imageUrl.trim() || null,
          startingPrice: Number(item.startingPrice) || 0,
        })),
      });
      router.push(`/rooms/${room.id}/lobby`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create auction.");
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

      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-10">
          <h1 className="font-display text-5xl font-extrabold text-foreground">
            Create Auction
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Define the core details and catalogue items for your upcoming event.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="mb-10">
          <div className="flex items-center gap-4">
            {/* Step 1 */}
            <div className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 font-mono text-xs font-bold transition-colors ${
                  step === 1
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-primary bg-transparent text-primary"
                }`}
              >
                1
              </div>
              <span
                className={`font-mono text-xs uppercase tracking-wider ${
                  step === 1 ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                Event Details
              </span>
            </div>

            {/* Connector */}
            <div className="flex-1">
              <div
                className={`h-px transition-colors ${
                  step === 2 ? "bg-primary" : "bg-border"
                }`}
              />
            </div>

            {/* Step 2 */}
            <div className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 font-mono text-xs font-bold transition-colors ${
                  step === 2
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-transparent text-muted-foreground"
                }`}
              >
                2
              </div>
              <span
                className={`font-mono text-xs uppercase tracking-wider ${
                  step === 2 ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                Catalogue
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Section 1: Event Details */}
          {step === 1 && (
            <div>
              <h2 className="mb-6 font-display text-lg font-semibold text-foreground">
                Event Details
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
                    className="border border-border bg-card text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="font-mono text-xs uppercase tracking-wider">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the auction theme, rules, or any special notes..."
                    rows={3}
                    className="border border-border bg-card text-sm resize-none"
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
                      className="border border-border bg-card text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="coverImageUrl" className="font-mono text-xs uppercase tracking-wider">
                    Cover Photo
                  </Label>
                  <Input
                    id="coverImageUrl"
                    type="url"
                    value={coverImageUrl}
                    onChange={(e) => setCoverImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="border border-border bg-card text-sm"
                  />
                </div>
              </div>

              {/* Step 1 Actions */}
              <div className="mt-10 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  className="border-foreground bg-transparent px-8"
                >
                  RESET
                </Button>
                <Button
                  type="button"
                  onClick={goToStep2}
                  className="bg-primary px-8 text-primary-foreground hover:bg-primary/90"
                >
                  NEXT
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Section 2: Catalogue Items */}
          {step === 2 && (
            <div>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-foreground">
                  Catalogue Items
                </h2>
                <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Lot {String(items.length).padStart(2, "0")}
                </span>
              </div>

              <div className="space-y-6">
                {items.map((item, index) => (
                  <div key={index} className="border border-border bg-card p-6">
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
                          <Label
                            htmlFor={`item-name-${index}`}
                            className="font-mono text-xs uppercase tracking-wider"
                          >
                            Item Name
                          </Label>
                          <Input
                            id={`item-name-${index}`}
                            value={item.name}
                            onChange={(e) => updateItem(index, "name", e.target.value)}
                            placeholder="e.g. Mid-Century Teak Sideboard"
                            className="border border-border bg-card text-sm"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label
                            htmlFor={`item-desc-${index}`}
                            className="font-mono text-xs uppercase tracking-wider"
                          >
                            Description
                          </Label>
                          <Textarea
                            id={`item-desc-${index}`}
                            value={item.description}
                            onChange={(e) => updateItem(index, "description", e.target.value)}
                            placeholder="Condition, dimensions, provenance..."
                            rows={3}
                            className="border border-border bg-card text-sm resize-none"
                          />
                        </div>

                        <div className="grid gap-6 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label
                              htmlFor={`item-price-${index}`}
                              className="font-mono text-xs uppercase tracking-wider"
                            >
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
                              className="border border-border bg-card text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label
                              htmlFor={`item-image-${index}`}
                              className="font-mono text-xs uppercase tracking-wider"
                            >
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

              {/* Step 2 Actions */}
              <div className="mt-10 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={goToStep1}
                  className="border-foreground bg-transparent px-8"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  PREVIOUS
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
            </div>
          )}

          {/* Global Error */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
      </div>
    </div>
  );
}
