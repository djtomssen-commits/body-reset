const fs = require("fs");
const path = require("path");

const exercisesDir =
  path.join(__dirname, "public", "exercises");

const result = [];

const files =
  fs.readdirSync(exercisesDir);

files.forEach(file => {

  if (!file.endsWith(".json")) return;

  const jsonPath =
    path.join(exercisesDir, file);

  const data =
    JSON.parse(
      fs.readFileSync(jsonPath, "utf8")
    );

  const folderName =
    file.replace(".json", "");

  const imagePath =
    `/exercises/${folderName}/${folderName}_0.jpg`;

  result.push({

    name: data.name,

    image: imagePath,

    primaryMuscles:
      data.primaryMuscles,

    secondaryMuscles:
      data.secondaryMuscles

  });

});

fs.writeFileSync(

  path.join(
    __dirname,
    "public",
    "exercises.json"
  ),

  JSON.stringify(result, null, 2)

);

console.log(
  "exercises.json erfolgreich erstellt"
);