CREATE SCHEMA IF NOT EXISTS rebrickable;

CREATE TABLE rebrickable.themes (
    id INTEGER PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    parent_id INTEGER REFERENCES rebrickable.themes(id)
);

CREATE TABLE rebrickable.colors (
    id INTEGER PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    rgb VARCHAR(6) NOT NULL,
    is_trans BOOLEAN NOT NULL,
    num_parts INTEGER,
    num_sets INTEGER,
    y1 INTEGER,
    y2 INTEGER
);

CREATE TABLE rebrickable.part_categories (
    id INTEGER PRIMARY KEY,
    name VARCHAR(200) NOT NULL
);

CREATE TABLE rebrickable.parts (
    part_num VARCHAR(20) PRIMARY KEY,
    name VARCHAR(250) NOT NULL,
    part_cat_id INTEGER NOT NULL REFERENCES rebrickable.part_categories(id),
    part_material VARCHAR(50)
);

CREATE TABLE rebrickable.part_relationships (
    rel_type VARCHAR(1) NOT NULL,
    child_part_num VARCHAR(20) NOT NULL REFERENCES rebrickable.parts(part_num),
    parent_part_num VARCHAR(20) NOT NULL REFERENCES rebrickable.parts(part_num),
    PRIMARY KEY (rel_type, child_part_num, parent_part_num)
);

CREATE TABLE rebrickable.elements (
    element_id VARCHAR(20) PRIMARY KEY,
    part_num VARCHAR(20) NOT NULL REFERENCES rebrickable.parts(part_num),
    color_id INTEGER NOT NULL REFERENCES rebrickable.colors(id),
    design_id VARCHAR(20)
);

CREATE TABLE rebrickable.sets (
    set_num VARCHAR(20) PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    year INTEGER NOT NULL,
    theme_id INTEGER NOT NULL REFERENCES rebrickable.themes(id),
    num_parts INTEGER NOT NULL,
    img_url VARCHAR(512)
);

CREATE TABLE rebrickable.minifigs (
    fig_num VARCHAR(20) PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    num_parts INTEGER NOT NULL,
    img_url VARCHAR(512)
);

CREATE TABLE rebrickable.inventories (
    id INTEGER PRIMARY KEY,
    version INTEGER NOT NULL,
    set_num VARCHAR(20) NOT NULL
);

CREATE TABLE rebrickable.inventory_parts (
    inventory_id INTEGER NOT NULL REFERENCES rebrickable.inventories(id) ON DELETE CASCADE,
    part_num VARCHAR(20) NOT NULL REFERENCES rebrickable.parts(part_num),
    color_id INTEGER NOT NULL REFERENCES rebrickable.colors(id),
    quantity INTEGER NOT NULL,
    is_spare BOOLEAN NOT NULL,
    img_url VARCHAR(512),
    PRIMARY KEY (inventory_id, part_num, color_id, is_spare)
);

CREATE TABLE rebrickable.inventory_sets (
    inventory_id INTEGER NOT NULL REFERENCES rebrickable.inventories(id) ON DELETE CASCADE,
    set_num VARCHAR(20) NOT NULL REFERENCES rebrickable.sets(set_num),
    quantity INTEGER NOT NULL,
    PRIMARY KEY (inventory_id, set_num)
);

CREATE TABLE rebrickable.inventory_minifigs (
    inventory_id INTEGER NOT NULL REFERENCES rebrickable.inventories(id) ON DELETE CASCADE,
    fig_num VARCHAR(20) NOT NULL REFERENCES rebrickable.minifigs(fig_num),
    quantity INTEGER NOT NULL,
    PRIMARY KEY (inventory_id, fig_num)
);

-- Speed up color-part aggregation per set
CREATE INDEX IF NOT EXISTS idx_rebrickable_inventories_set_num
    ON rebrickable.inventories (set_num);

-- Join from inventories to inventory_parts and group by color quickly
CREATE INDEX IF NOT EXISTS idx_rebrickable_inventory_parts_inventory_color
    ON rebrickable.inventory_parts (inventory_id, color_id);

-- Case-insensitive color lookups/sorting support
CREATE INDEX IF NOT EXISTS idx_rebrickable_colors_name_lower
    ON rebrickable.colors (lower(name));
