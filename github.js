async function gh_get_subfolder(name, url, path) {
	let response = await fetch(url);
	let data = (await response.json())["tree"];

	let folders = data.filter(i=>i.type=='tree');
	let files = data.filter(i=>i.type=='blob');


	console.log(folders, files)

	let el = document.createElement("details");
	let summary = document.createElement("summary");
	summary.innerText = name;
	el.appendChild(summary);

	for (var i=0;i<folders.length;i++) {
		el.appendChild(await gh_get_subfolder(folders[i].path.split("/").slice(-1)[0], folders[i].url, path+"/"+folders[i].path))
	}

	for (var i=0;i<files.length;i++) {
		let link = document.createElement("a");
		link.href = "#";
		link.innerText = files[i].path.split("/").slice(-1)[0];
		link.dataset.fullpath = path + "/" + files[i].path;
		console.log(files[i].url)
		link.onclick = function() {
			fetch("https://rawcdn.githack.com/wazzu-racing/log_files/main"+this.dataset.fullpath)
				.then(r=>r.bytes())
				.then(b=>fromfile(b.buffer))
			fname = "GitHub - "+this.dataset.fullpath
		}
		el.appendChild(link);
		el.appendChild(document.createElement("br"))
	}

	return el;
}

async function gh_get_files() {
	let node = await gh_get_subfolder("Hosted Files (GitHub)", "https://api.github.com/repos/wazzu-racing/log_files/git/trees/main", "");
	document.getElementById("github_files").appendChild(node);
}
// gh_get_files()
