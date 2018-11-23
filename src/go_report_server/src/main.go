package main

import (
	json "encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/aubm/interval"
)

type DATA struct {
	CDN  int   `json:"CDN"`
	P2P  int   `json:"P2P"`
	TIME int64 `json:"TIME"`
}
type Message struct {
	p2p_id  string `json:"p2p_id"`
	cdn_num int64  `json:"cdn_num"`
	p2p_num int64  `json:"p2p_num"`
}

var users map[string]interface{}
var baseCDN, baseP2P int

// Create interval check peer connection, use when start server
func initReportToClient() {
	stop := interval.Start(checkPeer, 5*time.Second)
	fmt.Println(stop)
}

// 	create response string, send to client to show in client web
// 	Usage:
// 	t := time.Now().UnixNano() / int64(time.Millisecond)
//	res := createResponse(data["p2p_id"].(string), int(data["cdn_num"].(float64)), int(data["p2p_num"].(float64)), t)
func createResponse(id string, cdn int, p2p int, time int64) string {
	var dataJSON DATA

	if users[id] == nil {

		var dat map[string]interface{}

		dataJSON = DATA{CDN: cdn, P2P: p2p, TIME: time}
		byt, _ := json.Marshal(dataJSON)

		// byt := []byte(`{"CDN":cdn,"P2P":p2p,"TIME":time}`)
		if err := json.Unmarshal(byt, &dat); err != nil {
			panic(err)
		}
		users[id] = dat

	} else {
		dat := users[id]
		byt, _ := json.Marshal(dat)
		err := json.Unmarshal(byt, &dataJSON)
		if err != nil {
			log.Println(err)
		}
		dataJSON.CDN = dataJSON.CDN + cdn
		dataJSON.P2P = dataJSON.P2P + p2p
		dataJSON.TIME = time
		byt, _ = json.Marshal(dataJSON)

		// byt := []byte(`{"CDN":cdn,"P2P":p2p,"TIME":time}`)
		if err := json.Unmarshal(byt, &dat); err != nil {
			panic(err)
		}
		users[id] = dat
	}

	allCDN, allP2P := update()
	fmt.Println(allCDN, allP2P)
	byt := []byte(`{}`)
	var dat map[string]interface{}
	if err := json.Unmarshal(byt, &dat); err != nil {
		panic(err)
	}
	dat["myID"] = id
	dat["myCDN"] = dataJSON.CDN
	dat["myP2P"] = dataJSON.P2P
	dat["allP2P"] = allP2P
	dat["allCDN"] = allCDN
	dat["numPeer"] = len(users)
	retString, _ := json.Marshal(dat)
	return string(retString)

}

func update() (allCDN int, allP2P int) {
	allCDN = baseCDN
	allP2P = baseP2P
	for _, val := range users {
		var dataUser DATA
		byt, _ := json.Marshal(val)
		err := json.Unmarshal(byt, &dataUser)
		if err != nil {
			log.Println(err)
		}
		allCDN = allCDN + dataUser.CDN
		allP2P = allP2P + dataUser.P2P
	}
	return allCDN, allP2P
}

func checkPeer() {
	if users == nil {
		return
	}
	for key, val := range users {
		var dataUser DATA
		byt, _ := json.Marshal(val)
		err := json.Unmarshal(byt, &dataUser)
		if err != nil {
			log.Println(err)
		}
		t := time.Now().UnixNano() / int64(time.Millisecond)
		if (t - dataUser.TIME) > 15000 {
			fmt.Println("Remove ", key)
			baseCDN = baseCDN + dataUser.CDN
			baseP2P = baseP2P + dataUser.P2P
			delete(users, key)
		}
	}
	if len(users) == 0 {
		baseCDN = 0
		baseP2P = 0
	}
}

func report(w http.ResponseWriter, r *http.Request) {
	// A very simple health check.

	// In the future we could report back on the status of our DB, or our cache
	// (e.g. Redis) by performing a simple PING, and include them in the response.

	// var message Message
	if r.Body == nil {
		http.Error(w, "Please send a request body", 400)
		return
	}

	responseData, err := ioutil.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Please send a valid request body", 400)
		log.Fatal(err)
	}

	responseBody := string(responseData)
	fmt.Println(responseBody)
	if responseBody == "OK" || responseBody == "ERROR"{
		return
	}
	var data map[string]interface{}
	err2 := json.Unmarshal([]byte(responseBody), &data)
	if err2 != nil {
		
		panic(err2)
	}


	t := time.Now().UnixNano() / int64(time.Millisecond)
	
	res := createResponse(data["peer_id"].(string), int(data["cdn_num"].(float64)), int(data["p2p_num"].(float64)), t)

	w.Header().Set("Access-Control-Allow-Methods", "POST")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Expose-Headers", "Content-Length")
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)
	// fmt.Println(responseBody)
	io.WriteString(w, string(res))
	fmt.Println("Receive report")
	fmt.Println(res)
	// json.NewEncoder(w).Encode("OKOK")
}

func main() {
	// init
	initReportToClient()
	byt := []byte(`{}`)
	if err := json.Unmarshal(byt, &users); err != nil {
		panic(err)
	}
	baseCDN = 0
	baseP2P = 0

	r := mux.NewRouter()

	// Setting the same matching conditions again and again can be boring, so we have a way
	// to group several routes that share the same requirements. We call it "subrouting".
	s := r.PathPrefix("/report").Methods("POST", "GET").Subrouter()
	s.HandleFunc("/interval", report)

	// Bind to a port and pass our router in
	srv := &http.Server{
		Handler: r,
		// Addr:    "127.0.0.1:8000",
		Addr: ":8090",
		// Good practice: enforce timeouts for servers you create!
		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
	}
	log.Fatal(srv.ListenAndServe())

}
