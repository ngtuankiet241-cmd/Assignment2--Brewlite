CREATE TABLE "DrinkSizeOption" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "priceAdjustment" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DrinkSizeOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ToppingOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ToppingOption_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ToppingOption_unitPrice_nonnegative" CHECK ("unitPrice" >= 0)
);

CREATE UNIQUE INDEX "ToppingOption_name_key" ON "ToppingOption"("name");

INSERT INTO "DrinkSizeOption" ("id", "label", "priceAdjustment", "sortOrder", "updatedAt")
VALUES
    ('S', 'Nhỏ', -5000, 0, CURRENT_TIMESTAMP),
    ('M', 'Vừa', 0, 1, CURRENT_TIMESTAMP),
    ('L', 'Lớn', 5000, 2, CURRENT_TIMESTAMP);

INSERT INTO "ToppingOption" ("id", "name", "unitPrice", "sortOrder", "updatedAt")
VALUES
    ('pearls', 'Trân châu đen', 7000, 0, CURRENT_TIMESTAMP),
    ('peach-jelly', 'Thạch đào', 8000, 1, CURRENT_TIMESTAMP),
    ('cheese-foam', 'Kem cheese', 10000, 2, CURRENT_TIMESTAMP);
