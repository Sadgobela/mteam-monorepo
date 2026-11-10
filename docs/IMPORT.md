# Importing listings

For bringing MTeam's own listings in from a spreadsheet. Only import listings MTeam has the right to publish.

1. Fill a sheet using the columns in `import-template.csv`, and save it from Excel as "CSV UTF-8".
2. Run this, with the phone number of the MTeam account that will own the listings:

   ```
   pnpm --filter @mteam/db db:import /full/path/to/file.csv 555123456
   ```

   Listings arrive as pending, for review in the admin page. Add `--publish` at the end to put them straight on the site. They are never marked verified, because that takes a broker's visit.

3. The command prints how many were created and names each bad row by its Excel row number and the column at fault. Fix those rows and run the same file again: rows already imported are skipped by their `ref`, and are not updated.

## Columns

- `ref` is required: the listing's number in the source system, unique within it.
- Any field of the posting form can be a column, and blank cells count as not given. Required: `deal`, `type`, `city`, `address`, `title`, `description`, `price`, `currency`, `area`. `district` is required in cities that have districts, `rooms` for homes.
- City, district, street and metro must match the names on the site exactly, in Georgian.
- Fixed choices such as `condition` or `heating` use the keys in `packages/shared/src/details.ts`.
- `features` and `photos` hold several values separated by `|`. `photos` are web addresses of images already uploaded, at most 10.
- `agentPhone` links the listing to a broker who has an account with the broker role. Blank means the owner's number is shown.
