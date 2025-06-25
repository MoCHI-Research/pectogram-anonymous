#!bin/bash

# This file and images.json be in the images folder to work
# In images.json, will need to delete one comma at the end and these two files
# Works correctly with .png and .jpg, not .jpeg
# Use: bash ./json.sh > images.json

echo "{"

for img in *; do
    echo "\"${img%????}\" : \"${img}\","
done

echo "}"

exit 0