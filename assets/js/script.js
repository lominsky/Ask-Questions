// Your web app's Firebase configuration
var firebaseConfig = {
	apiKey: "AIzaSyDA9LFO_QJaMbb7JoxsBX0f8Y8_bAl0RSc",
	authDomain: "ask-5cf85.firebaseapp.com",
	databaseURL: "https://ask-5cf85.firebaseio.com",
	projectId: "ask-5cf85",
	storageBucket: "ask-5cf85.appspot.com",
	messagingSenderId: "401055363485",
	appId: "1:401055363485:web:e1bb704da7e44afd82ff74"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
var provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({
   prompt: 'select_account'
});
var user = null;
var posts = [];
let query = getQuery();
$(".view").hide();

let isFirstLoad = true;
firebase.auth().onAuthStateChanged(function(u) {
  if (u) {
  	user = u;
  	user.isAdmin = false;
  	getPosts();
  	firebase.database().ref("adminTest").once("value", function(snapshot){
  		user.isAdmin = true;
  		$('.admin-only').show();
  	});
  } else {
  	if(!isFirstLoad)
  		//log("onAuthStateChanged - null user", user.displayName);
  	user = null;
  	setDisplay("login");
  }
  isFirstLoad = false;
});

function login() {
	firebase.auth().signInWithPopup(provider).then(function(result) {

	}, function(error) {
	  // The provider's account email, can be used in case of
	  // auth/account-exists-with-different-credential to fetch the providers
	  // linked to the email:
	  var email = error.email;
	  // The provider's credential:
	  var credential = error.credential;
	  // In case of auth/account-exists-with-different-credential error,
	  // you can fetch the providers using this:
	  if (error.code === 'auth/account-exists-with-different-credential') {
	    auth.fetchSignInMethodsForEmail(email).then(function(providers) {
	      // The returned 'providers' is a list of the available providers
	      // linked to the email address. Please refer to the guide for a more
	      // complete explanation on how to recover from this error.
	    });
	  }
	});

	firebase.auth().signInWithPopup(provider).then(result => {
		// log("login - success", {name: result.user.displayName, email: result.user.email, uid: result.user.uid});
	}, err => {
		log("function login() - error", err);
	});
	// log("Login function called.") //This seems to be causing an error
}

function logoutAccount() {
	firebase.auth().signOut().then(function() {
		// log("function logoutAccount() - success", user.displayName);
		firebase.database().ref("posts").off("value", postListener);
	});	
}

function setDisplay(val) {
	$(".view").hide();
	$("[view='" + val + "']").show();
}

function ask() {
	let field = $('#questionTextArea');
	let question = field.val();
	if(question.length < 3) return false;
	field.val("");


	let now = (new Date()).getTime();
	let post = {
		question: question,
		timestamp: now,
		user: getHash(now)
	}

	let stayAnon = $("#anonBox").is(':checked');
	console.log(stayAnon)
	if(!stayAnon) {
		post.userName = user.displayName;
	}

	firebase.database().ref("posts/questions").push(post, function(error) {
		if (error) {
			error.post = post;
			log("function ask() - 'posts/questions' push error", error);
		} else {
			// log('function ask() success', post);
			getPosts();
		}
	});
}

let postListener;
function getPosts() {
	postListener = firebase.database().ref("posts").once("value", function(snapshot) {
		let data = snapshot.val();
		posts = [];
		if(data == null) data = {};
		if(data.posts == null) data.posts = {};
		if(data.likes == null) data.likes = {};
		if(data.responses == null) data.responses = {};
		for(i in data.questions) {
			let question = data.questions[i];
			if(question.hidden == true) continue;
			question.id = i;
			if (data.likes[i] == null) {
				question.likes = {};
			} else {
				question.likes = data.likes[i];
			}
			if (data.responses[i] == null) {
				question.responses = {};
			} else {
				question.responses = data.responses[i];
			}

			//Check if the user liked the question or if it's their question
			let hash = getHash(question.timestamp);
			question.isLiked = false;
			for(i in question.likes) {
				if(i == hash) {
					question.isLiked = true;
				}
			}
			question.isOwner = question.user == hash;
			posts.push(question);
		}
		displayPosts();
		if(window.location.pathname != "/admin.html") {
		  	setDisplay("main");
		 }
	}, function(error) {
		log("function getPosts() 'posts' on value error", error);
	  	setDisplay("login");
	});
}

function displayPosts() {
	$("#postDiv").empty();

	//Filter for likes then responses
	let filteredPosts = posts.filter(post => (post.isLiked && filter.liked || !post.isLiked && filter.unliked));
	filteredPosts = filteredPosts.filter(post => (Object.keys(post.responses).length == 0 && filter.unanswered || Object.keys(post.responses).length > 0 && filter.answered));
	filteredPosts = filteredPosts.filter(post => post.question.toLowerCase().includes(filter.search))
	filteredPosts = filteredPosts.filter(post => (post.isOwner && filter.isOwner || !post.isOwner && filter.notOwner));

	//Sort
	filteredPosts.sort(function(a, b) {
		if(filter.sortCategory == "likeCount") {
			a.likeCount = Object.keys(a.likes).length;
			b.likeCount = Object.keys(b.likes).length;
		}
		let descending = 1;
		if(!filter.descending) descending = -1;
		return (b[filter.sortCategory] - a[filter.sortCategory]) * descending;
	});

	if(query.id != null) {
		filteredPosts = posts.filter(post => post.id == query.id);
		$('.form-group').hide();
		$('.searchBar').hide();
		$('.filterBox').hide();
	}

	for(i in filteredPosts) {
		let post = filteredPosts[i];
		let timestamp = new Date(post.timestamp);

		let card = $("<div></div>").addClass("card mb-2").attr("id", post.id).attr("timestamp", post.timestamp);
		
		let cardBody = $("<div></div>").addClass("card-body");
		let asker = $("<div></div>").addClass("answer-user").text(post.userName + " asks:");
		let question = $("<p></p>").addClass("card-text question-text").text(post.question);
		let ts = $("<p></p>").addClass("card-text timestamp").text("Asked " + timestamp.toLocaleDateString() + " at " + timestamp.toLocaleTimeString());
		
		let feedback = $("<div style='display: inline-block'></div>").addClass("feedback-box");
		let like = $("<span></span>").addClass("like").click(toggleLike);
		let likeCount = Object.keys(post.likes).length;
		let thumbsUp = $("<i></i>").attr("data-feather","thumbs-up");
		let gq = $("<span></span>").text("Good Question (" + likeCount + ")");
		if(post.isLiked) like.addClass("active");
		like.append(thumbsUp, gq);

		let share = $("<div style='display:inline-block;float:right;'></div>").click(function() {
			let link = location.origin + "?id=" + post.id;
			navigator.clipboard.writeText(link);
		});
		let link = $("<i></i>").attr("data-feather","link");
		share.append(link, " Copy Link")

		feedback.append(like, share);

		
		if(post.userName) {
			cardBody.append(asker);
		}
		cardBody.append(question, ts, feedback, share);

		let responses = $("<div></div>").addClass("mt-3");
		for(i in post.responses) {
			let resp = post.responses[i];
			let div = $("<div></div>").addClass("mb-1")
			let answerer = $("<div></div>").addClass("answer-user").text(resp.user);
			let time = $("<div></div>").addClass("answer-time").text((new Date(resp.timestamp)).toLocaleString());
			let answer = $("<div></div>").addClass("answer-text").text(resp.answer);
			div.append(answerer, answer, time);
			responses.append(div);
		}
		if($(responses).html != "") cardBody.append(responses);

		let response = $("<div></div>").addClass("response-box admin-only").hide();
		if(user.isAdmin) response.show();
		let inputGroup = $("<div></div>").addClass("input-group mt-3 mb-3").keyup(addButton);
		let textarea = $("<textarea></textarea>")
			.addClass("form-control")
			.attr("rows", "1")
			.focus(taHasFocus)
			.blur(taLostFocus);
		// let br = $("<br>");
		// let button = $("<button></button>").addClass("respond").attr("type", "button").attr("rel", "no-refresh").text("Answer").click(respond);
		inputGroup.append(textarea);
		// response.append(inputGroup, button);
		response.append(inputGroup);

		

		cardBody.append(response);
		card.append(cardBody);
		$("#postDiv").append(card);
	}
	if(filteredPosts.length == 0) {
		$("#postDiv").append("<div><h3>Sorry, there are no questions that match your filter criteria.</h3></div>");
	}
	feather.replace();
}

function taHasFocus(e) {
	let target = e.target
	if(target == null) target = e;
	$(target).attr("rows", "4");
}

function taLostFocus(e) {
	let target = e.target
	if(target == null) target = e;
	let ta = $(target);
	if(ta.val().length == 0) {
		ta.attr("rows", "1")
	}
}

function addButton(e) {
	let buttons = $(e.target.parentElement).siblings("button");
	if(e.target.value.length == 0) {
		buttons.remove();
		return false;
	}
	if(buttons.length > 0) return false
	let button = $("<button></button>").addClass("respond").attr("type", "button").attr("rel", "no-refresh").text("Answer as " + user.displayName).click(respond);
	$(e.target).closest(".response-box").append(button);
}

function respond(e) {
	let div = e.target.parentElement;
	let box = div.parentElement.parentElement

	let postId = $(box).attr("id");
	let response = $(div).find("textarea").val()

	if(response.length < 2) return false;

	$(div).find("textarea").val("")
	let respObj = {
		answer: response,
		user: user.displayName,
		timestamp: (new Date()).getTime()
	};


	for(i in posts) {
		if(posts[i].id == postId) {
			posts[i].responses[Math.random()] = respObj;
		}
	}

	firebase.database().ref("posts/responses/" + postId).push(respObj, function(error) {
	    if (error) {
	    	error.postId = postId;
	    	error.respObj = respObj;
	     	log("function respond() push error", error);
	    } else {
	    	$(e.target).remove();
	    	displayPosts();
	    }
	});
}

function toggleLike(e) {
	let span = e.target
	let box = span.parentElement.parentElement.parentElement.parentElement;
	let postId = $(box).attr('id');
	let timestamp = $(box).attr('timestamp');
	let hash = getHash(timestamp);
	let ref = firebase.database().ref("posts/likes/" + postId + "/" + hash);
	let active = $(span.parentElement).hasClass('active');
	let now = (new Date()).getTime();


	for(i in posts) {
		if(posts[i].id == postId) {
			posts[i].isLiked = !posts[i].isLiked;
			posts[i].isLiked ? posts[i].likes[hash] = now : delete posts[i].likes[hash];
		}
	}


	if(active) {
		ref.remove().catch(error => { 
			error.now = now;
			error.postId = postId;
			error.hash = hash;
			log("function toggleLike() remove error", error);
       });
	} else {
		ref.set(now, error => {
			if (error) {
				error.now = now;
				error.postId = postId;
				error.hash = hash;
				log("function toggleLike() set error", error);
			}
		});
	}
	displayPosts();
}

let filter = {
	liked: true,
	unliked: true,
	answered: true,
	unanswered: true,
	isOwner: true,
	notOwner: true,
	sortCategory: "timestamp",
	descending: true,
	search: ""
}
function updateFilters() {
	let filters = $("#filters").find('input');
	filter.liked = filters[0].checked;
	filter.unliked = filters[1].checked;
	filter.answered = filters[2].checked;
	filter.unanswered = filters[3].checked;
	filter.isOwner = filters[4].checked;
	filter.notOwner = filters[5].checked;

	let sorts = $("#sorts").find('input');
	if(sorts[0].checked) filter.sortCategory = "timestamp";
	if(sorts[1].checked) filter.sortCategory = "likeCount";
	if(sorts[2].checked) filter.descending = false;
	if(sorts[3].checked) filter.descending = true;

	search();
}

function search() {
	filter.search = $("#searchBar").val().toLowerCase();
	displayPosts();
}

function getQuery() {
	let s = window.location.search;
	if(s.length > 0) s = s.substring(1);
	s = s.split("&")
	let temp = {};
	for(i in s) {
		s[i] = s[i].split("=");
		if(s[i].length != 2) continue;
		temp[s[i][0]] = s[i][1];
	}
	return temp;
}

function getHash(timestamp) {
	return md5(user.uid + timestamp);
}

function goHome() {
	window.location.href = window.location.origin;
}

function log(message, data = null) {
	let browserInfo={
	    timeOpened:new Date(),
	    timezone:(new Date()).getTimezoneOffset()/60,
	    pageon: window.location.pathname,
	    referrer: document.referrer,
	    previousSites: history.length,
	    browserName: navigator.appName,
	    browserEngine: navigator.product,
	    browserVersion1a: navigator.appVersion,
	    browserVersion1b: navigator.userAgent,
	    browserLanguage: navigator.language,
	    browserOnline: navigator.onLine,
	    browserPlatform: navigator.platform,
	    javaEnabled: navigator.javaEnabled(),
	    dataCookiesEnabled: navigator.cookieEnabled,
	    dataCookies1: document.cookie,
	    dataCookies2: decodeURIComponent(document.cookie.split(";")),
	    sizeScreenW: screen.width,
	    sizeScreenH: screen.height,
	    sizeInW: innerWidth,
	    sizeInH: innerHeight,
	    sizeAvailW: screen.availWidth,
	    sizeAvailH: screen.availHeight,
	    scrColorDepth: screen.colorDepth,
	    scrPixelDepth: screen.pixelDepth,
    };

	let tempUser = {
		uid: "N/A",
		name: "N/A",
		email: "N/A",
	}
	if(user) {
		tempUser = {
			uid: user.uid,
			name: user.displayName,
			email: user.email,
		}
	}
	firebase.database().ref("log").push({
		timestamp: (new Date()).getTime(),
		message: message,
		data: JSON.stringify(data),
		user: tempUser,
		browser: browserInfo
	})
}