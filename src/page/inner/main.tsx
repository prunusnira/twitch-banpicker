import React, {Component, Fragment} from 'react';
import { connect } from 'react-redux';
import { AnyAction, bindActionCreators, Dispatch } from 'redux';
import Message from '../../data/message';
import { Observer } from '../../data/observer/observer';
import Parser from '../../data/parser';
import TTSPlay from '../../data/tts';
import User from '../../data/user';
import GetUserProfile from '../../data/userProfile';
import { actionCreator } from '../../redux/action';
import { StoreState } from '../../redux/reducer';
import Footer from '../footer/footer';
import Header from '../header/header';
import BanOverAlert from './banoverAlert';
import BanPickContainer from './banpick/banpickContainer';
import ChatPresenter from './chat/chatPresenter';
import Config from './config/config';
import IRCConnect from './irc/ircConnect';

import './main.css';
import PhaseIndicator from './phase';
import Team from './teamlist/team';
import TeamList from './teamlist/teamlist';
import UserDialog from './userdlg/userdlg';

interface Props {
    acctok: string,
    clientId: string,
    userid: string,
    scopes: Array<string>,
    Actions: typeof actionCreator
}

interface State {
    start: boolean,
    getUsers: boolean,

    // streamer info
    streamer: User,

    team0: Team,
    team1: Team,
    hideTeamList: boolean,

    pickTeam0: Array<Message>,
    banTeam0: Array<boolean>,
    pickTeam1: Array<Message>,
    banTeam1: Array<boolean>,

    currentUser: User|null,
    currentChat: Array<Message>,
    userDlg: boolean,

    pickSize: number,
    banInterval: number,
    banNum: number,

    currentPickCount: number,
    currentBanCount: number,
    currentPhase: number,   // 0: 시작안함, 1: 픽, 2: 밴
    totalPickCount: number,

    banDlg: boolean
}

class MainPage extends Component<Props, State> {
    irc: IRCConnect;
    observer: Observer;
    userProfile: GetUserProfile;
    tts: TTSPlay;
    currentUserLastMessage: Message;
    currentUserSubscribed: boolean;

    state: State = {
        start: false,
        getUsers: false,
        streamer: new User("", "", false),
        team0: new Team(1, "TEAM 1"),
        team1: new Team(2, "TEAM 2"),
        hideTeamList: false,
        pickTeam0: new Array<Message>(),
        banTeam0: new Array<boolean>(),
        pickTeam1: new Array<Message>(),
        banTeam1: new Array<boolean>(),
        currentUser: null,
        currentChat: new Array<Message>(),
        userDlg: false,
        pickSize: 5,
        banInterval: 3,
        banNum: 1,
        currentPickCount: 0,
        currentBanCount: 0,
        currentPhase: 0,
        totalPickCount: 0,
        banDlg: false
    };

    constructor(props: Props) {
        super(props);
        this.start = this.start.bind(this);
        this.switchGetUser = this.switchGetUser.bind(this);
        this.switchPhase = this.switchPhase.bind(this);
        this.reset = this.reset.bind(this);
        this.tokenReset = this.tokenReset.bind(this);
        this.changeUserStatePicked = this.changeUserStatePicked.bind(this);

        this.observer = new Observer();
        this.irc = new IRCConnect(this.props.acctok, this.props.userid, this.msgProcess);
        this.irc.registerObserver(this.observer);

        this.userProfile = new GetUserProfile();
        this.tts = new TTSPlay();

        this.currentUserLastMessage = new Message('', '', '');
        this.currentUserSubscribed = false;
    }

    componentDidMount = () => {
        this.userProfile.requestUserProfile(
            this.props.userid, this.props.acctok,
            this.props.clientId, this.updateStreamerInfo);
    }

    // 동작 시작
    start = () => {
        this.setState({
            start: true,
            getUsers: true
        });
    }

    switchGetUser = () => {
        this.setState({
            getUsers: !this.state.getUsers
        });
    }

    // 스트리머 정보 업데이트
    updateStreamerInfo = (map: Map<string, string>) => {
        const info = new User(
            this.props.userid, map.get("display_name")!, true
        );
        info.setProfileUrl(map.get("profile_image_url")!);

        this.setState({
           streamer: info 
        });
    }

    // 기본 설정
    changePickCount = (up: boolean) => {
        if(up) {
            this.setState({
                pickSize: this.state.pickSize + 1
            });
        }
        else {
            if(this.state.pickSize > 0) {
                this.setState({
                    pickSize: this.state.pickSize - 1
                });
            }
        }
    }
    changeBanInterval = (up: boolean) => {
        if(up) {
            this.setState({
                banInterval: this.state.banInterval + 1
            });
        }
        else {
            if(this.state.banInterval > 0) {
                this.setState({
                    banInterval: this.state.banInterval - 1
                });
            }
        }
    }
    changeBanCount = (up: boolean) => {
        if(up) {
            this.setState({
                banNum: this.state.banNum + 1
            });
        }
        else {
            if(this.state.banNum > 0) {
                this.setState({
                    banNum: this.state.banNum - 1
                });
            }
        }
    }

    reset = () => {
        this.setState({start: false,
            team0: new Team(1, "TEAM 1"),
            team1: new Team(2, "TEAM 2"),
            hideTeamList: false,
            pickTeam0: new Array<Message>(),
            banTeam0: new Array<boolean>(),
            pickTeam1: new Array<Message>(),
            banTeam1: new Array<boolean>(),
            currentUser: null,
            currentChat: new Array<Message>(),
            userDlg: false,
            pickSize: 5,
            banInterval: 3,
            banNum: 1,
            currentPickCount: 0,
            currentBanCount: 0,
            currentPhase: 0,
            totalPickCount: 0,
            banDlg: false
        });
    }

    tokenReset = () => {
        this.props.Actions.removeUserOn();
    }

    msgProcess = (msg: string) => {
        if(this.state.start) {
            const msgParsed = Parser.parse(msg);
            const map = new Map<string, string>();
    
            if(msgParsed.size > 0) {
                Array.from(msgParsed.keys()).forEach(s => {
                    map.set(s, msgParsed.get(s)!);
                });
    
                // 뱃지 검사해서 subscriber 확인
                const badges = map.get("badges")!.split(",");
                let isSub = false;
                badges.forEach(v => {
                    if(v.startsWith('subscriber')) {
                        isSub = true;
                    }
                });
    
                const team0 = this.state.team0;
                const team1 = this.state.team1;
                let user = null;

                const msg = new Message(map.get("userid")!, map.get("display-name")!, map.get("msg")!);
                
                if(team0.hasMember(msg.getUserId())) {
                    user = team0.getMember(msg.getUserId());
                }
                else if(team1.hasMember(msg.getUserId())) {
                    user = team1.getMember(msg.getUserId());
                }
                else {
                    user = new User(map.get("userid")!, map.get("display-name")!, isSub);
                }
                user!.updateLastMessage(msg);
                
                // 팀 등록
                if(this.state.getUsers && (msg.getMessage().startsWith("!team ") || msg.getMessage().startsWith("!팀 "))) {
                    const teamNum = msg.getMessage().split(" ")[1].split("\r\n")[0];


                    let alreadyPicked = false;
                    // 이미 다른 팀에 들어가있다면 삭제함
                    if(team0.hasMember(msg.getUserId())) {
                        if(team0.getMember(msg.getUserId())!.isPicked()) {
                            alreadyPicked = true;
                        }
                        team0.removeMember(msg.getUserId());
                    }
                    if(team1.hasMember(msg.getUserId())) {
                        if(team1.getMember(msg.getUserId())!.isPicked()) {
                            alreadyPicked = true;
                        }
                        team1.removeMember(msg.getUserId());
                    }

                    if(alreadyPicked) {
                        user!.setPicked();
                    }
    
                    if(teamNum === "1") {
                        console.log(msg.getUserId()+"가 팀 "+teamNum+"으로 등록");
                        team0.addMember(user!);
                    }
                    else if(teamNum === "2") {
                        console.log(msg.getUserId()+"가 팀 "+teamNum+"으로 등록");
                        team1.addMember(user!);
                    }
                    
                    this.setState({
                        team0: team0,
                        team1: team1
                    });
                }
    
                // 픽 등록
                // 검사항목: 현재 유저가 선택된 유저인가
                if(msg.getUserId() === this.state.currentUser?.getUserId()) {
                    if(msg.getMessage().startsWith("!pick ") || msg.getMessage().startsWith("!픽 ")) {
                        let nextPick = this.state.currentPickCount;

                        const pickSplited = msg.getMessage().split(" ");
                        let pickMsg = "";
                        for(let i = 1; i < pickSplited.length; i++) {
                            pickMsg += pickSplited[i];
                            if(i !== pickSplited.length - 1) pickMsg += " ";
                        }
        
                        let currentTeam = 0;

                        const pickTeam0 = this.state.pickTeam0;
                        const pickTeam1 = this.state.pickTeam1;
                        const banTeam0 = this.state.banTeam0;
                        const banTeam1 = this.state.banTeam1;
                        const team0 = this.state.team0;
                        const team1 = this.state.team1;
                        let totalPick = this.state.totalPickCount;
    
                        if(team0.hasMember(msg.getUserId())) {
                            currentTeam = 1;
                            msg.setMessage(pickMsg);
    
                            // 팀에 소속되어있다면 해당 팀의 픽 리스트에 등록
                            pickTeam0.push(msg);
                            banTeam0.push(false);
    
                            // 픽 한 유저는 리스트에서 더 사용할 수 없도록 처리함
                            team0.changePickable(msg.getUserId());
                            team0.currentPick++;
                            nextPick++;
                        }
                        if(team1.hasMember(msg.getUserId())) {
                            currentTeam = 2;
                            msg.setMessage(pickMsg);
                            pickTeam1.push(msg);
                            banTeam1.push(false);
                            team1.changePickable(msg.getUserId());
                            team1.currentPick++;
                            nextPick++;
                        }
        
                        totalPick++;
                        console.log(msg.getUserId()+"(팀"+currentTeam+") MSG: "+pickMsg);
    
                        // 현재 픽 수와 밴 간격을 계산하여 다음 페이즈를 결정
                        let nextPhase = 1;
    
                        if(nextPick >= this.state.banInterval * 2) {
                            nextPhase = 1;
                            nextPick = 2;

                            // 각 팀의 현재 pick도 초기화
                            team0.currentPick = 0;
                            team1.currentPick = 0;
                        }
                        
                        this.setState({
                            userDlg: false,
                            currentUser: null,
                            currentPickCount: nextPick,
                            currentChat: new Array<Message>(),
                            currentPhase: nextPhase,

                            pickTeam0: pickTeam0,
                            pickTeam1: pickTeam1,
                            banTeam0: banTeam0,
                            banTeam1: banTeam1,
                            team0: team0,
                            team1: team1,
                            totalPickCount: totalPick
                        });
                    }
                    else {
                        // 메시지 받아서 디스플레이 되도록 추가
                        this.state.currentChat.push(msg);
                        this.setState({});
                        this.scrollToBottomChat();
                        this.tts.speech(msg.getMessage());
                    }
                }
            }
        }
    }

    // 랜덤으로 유저 선택하기 (callback)
    getUserSelected = (user: User) => {
        // 해당 유저의 프로필 이미지를 가져오기 위해 유저 정보 불러오기를 수행
        this.currentUserLastMessage = user.getLastMessage();
        this.currentUserSubscribed = user.isSubscriber();
        this.userProfile.requestUserProfile(
            user.getUserId(),
            this.props.acctok,
            this.props.clientId,
            this.updateCurrentUser);
    }

    updateCurrentUser = (map: Map<string, string>) => {
        const user = new User(
            map.get("login")!, map.get("display_name")!, this.currentUserSubscribed
        );
        user.setProfileUrl(map.get("profile_image_url")!);

        console.log("선택된 유저: "+user.getUserName() + " ("+user.getUserId()+")");

        this.tts.speech(user.getUserName());
        this.setState({
            currentUser: user,
            userDlg: true,
            currentPhase: 1,
            currentChat: [this.currentUserLastMessage]
        });
    }

    closeUserWindow = () => {
        this.setState({
            userDlg: false,
            currentChat: new Array<Message>(),
            currentUser: null
        });
    }

    // region Picked Message Edit
    editPick = (team: number, val: string, idx: number) => {
        const pickTeam0 = this.state.pickTeam0;
        const pickTeam1 = this.state.pickTeam1;
        if(team === 1) {
            pickTeam0[idx].setMessage(val);
        }
        else if(team === 2) {
            pickTeam1[idx].setMessage(val);
        }
        
        this.setState({
            pickTeam0: pickTeam0,
            pickTeam1: pickTeam1
        });
    }

    removePick = (team: number, idx: number) => {
        const pickTeam0 = this.state.pickTeam0;
        const banTeam0 = this.state.banTeam0;
        const team0 = this.state.team0;

        const pickTeam1 = this.state.pickTeam1;
        const banTeam1 = this.state.banTeam1;
        const team1 = this.state.team1;

        let pickCnt = this.state.currentPickCount;

        if(team === 1) {
            pickTeam0.splice(idx, 1);
            banTeam0.splice(idx, 1);
            team0.currentPick--;
        }
        else if(team === 2) {
            pickTeam1.splice(idx, 1);
            banTeam1.splice(idx, 1);
            team1.currentPick--;
        }
        pickCnt--;

        this.setState({
            pickTeam0: pickTeam0,
            pickTeam1: pickTeam1,
            banTeam0: banTeam0,
            banTeam1: banTeam1,
            team0: team0,
            team1: team1,
            currentPickCount: pickCnt
        });
    }

    banPick = (team: number, idx: number) => {
        let nextBan = this.state.currentBanCount;
        let banDlg = this.state.banDlg;
        const banTeam0 = this.state.banTeam0;
        const banTeam1 = this.state.banTeam1;
        const team0 = this.state.team0;
        const team1 = this.state.team1;

        if(team === 1) {
            // 밴 하기 전에 현재 밴 숫자 확인
            if(this.state.team0.currentBan >= this.state.banNum) {
                // 현재 턴의 밴 횟수 초과
                banDlg = true;
            }
            else {
                banTeam0[idx] = true;
                team0.currentBan++;
                nextBan++;
            }
        }
        else if(team === 2) {
            if(this.state.team1.currentBan >= this.state.banNum) {
                // 현재 턴의 밴 횟수 초과
                banDlg = true;
            }
            else {
                banTeam1[idx] = true;
                team1.currentBan++;
                nextBan++;
            }
        }

        // 현재 밴 수와 밴 간격을 계산하여 다음 페이즈를 결정
        let nextPhase = 2;

        if(nextBan >= this.state.banNum * 2) {
            nextPhase = 1;
            nextBan = 0;

            // 각 팀의 현재 pick도 초기화
            team0.currentBan = 0;
            team1.currentBan = 0;
        }
        this.setState({
            currentBanCount: nextBan,
            currentPhase: nextPhase,
            banTeam0: banTeam0,
            banTeam1: banTeam1,
            team0: team0,
            team1: team1,
            banDlg: banDlg
        });
    }

    banAlertClose = () => {
        this.setState({
            banDlg: false
        });
    }

    changeUserStatePicked = (user: User) => {
        const team0 = this.state.team0;
        const team1 = this.state.team1;

        if(team0.hasMember(user.getUserId())) {
            team0.changePickable(user.getUserId());
        }
        if(team1.hasMember(user.getUserId())) {
            team1.changePickable(user.getUserId());
        }
        this.setState({
            team0: team0,
            team1: team1
        });
    }

    changeTeamName = (team: number, title: string) => {
        const team0 = this.state.team0;
        const team1 = this.state.team1;

        if(team === 1) {
            team0.name = title;
        }
        if(team === 2) {
            team1.name = title;
        }
        this.setState({
            team0: team0,
            team1: team1
        });
    }

    // 강제 페이즈 변경
    switchPhase = () => {
        if(this.state.currentPhase === 1) {
            this.setState({
                currentPhase: 2,
                currentBanCount: 0
            });
        }
        else if(this.state.currentPhase === 2) {
            this.setState({
                currentPhase: 1,
                currentPickCount: 0
            });
        }
    }

    // 팀 목록 표기
    switchTeamListVisible = () => {
        this.setState({
            hideTeamList: !this.state.hideTeamList
        });
    }

    // 아래로 내리기
    scrollToBottomChat() {
        this.setState({}, function() {
            document.getElementById("userchat")!.scrollTop = document.getElementById("userchat")!.scrollHeight;
        });
    }

    // render
    render() {
        return (
            <Fragment>
                <Header
                    streamer={this.state.streamer}
                    tokenReset={this.tokenReset} />
                <div className="d-flex stretch">
                    <div className="flexwidth-1">
                        <TeamList
                            team={this.state.team0}
                            totalPickCount={this.state.totalPickCount}
                            pickCount={this.state.pickSize}
                            banInterval={this.state.banInterval}
                            hide={this.state.hideTeamList}
                            changePick={this.changeUserStatePicked}
                            changeTeamName={this.changeTeamName}
                            getUserSelected={this.getUserSelected} />
                        <TeamList
                            team={this.state.team1}
                            totalPickCount={this.state.totalPickCount}
                            pickCount={this.state.pickSize}
                            banInterval={this.state.banInterval}
                            hide={this.state.hideTeamList}
                            changePick={this.changeUserStatePicked}
                            changeTeamName={this.changeTeamName}
                            getUserSelected={this.getUserSelected} />
                    </div>
                    <div className="flexwidth-2 d-flex flex-column">
                        <PhaseIndicator
                            phase={this.state.currentPhase}
                            switchPhase={this.switchPhase} />
                        <div className="d-flex banpickbox-height">
                            <div className="banpickbox-width">
                                <BanPickContainer
                                    picklist={this.state.pickTeam0}
                                    banlist={this.state.banTeam0}
                                    teamname={this.state.team0.name}
                                    teamnum={1}
                                    phase={this.state.currentPhase}
                                    editPick={this.editPick}
                                    removePick={this.removePick}
                                    banPick={this.banPick} />
                            </div>
                            <div className="banpickbox-width">
                                <BanPickContainer
                                    picklist={this.state.pickTeam1}
                                    banlist={this.state.banTeam1}
                                    teamname={this.state.team1.name}
                                    teamnum={2}
                                    phase={this.state.currentPhase}
                                    editPick={this.editPick}
                                    removePick={this.removePick}
                                    banPick={this.banPick} />
                            </div>
                        </div>
                    </div>
                    <div className="flexwidth-3">
                        <Config
                            pickSize={this.state.pickSize}
                            banInterval={this.state.banInterval}
                            banNum={this.state.banNum}
                            start={this.state.start}
                            getUsers={this.state.getUsers}
                            startMethod={this.start}
                            switchGetUser={this.switchGetUser}
                            changePickCount={this.changePickCount}
                            changeBanInterval={this.changeBanInterval}
                            changeBanCount={this.changeBanCount}
                            reset={this.reset}
                            hideTeamList={this.switchTeamListVisible} />
                        <ChatPresenter
                            username={this.state.streamer.getUserId()} />
                    </div>
                </div>
                <UserDialog
                    key="userdialog"
                    user={this.state.currentUser}
                    chat={this.state.currentChat}
                    display={this.state.userDlg}
                    close={this.closeUserWindow} />
                <BanOverAlert
                    alertOpen={this.state.banDlg}
                    close={this.banAlertClose} />
                <Footer />
            </Fragment>
        );
    }
}

const mapStateToProps = (state: StoreState) => {
    return {
        acctok: state.tokenReducer.acctok,
        scopes: state.tokenReducer.scope,
        userid: state.tokenReducer.loginname,
        clientId: state.tokenReducer.clientId
    }
};

const mapDispatchToProps = (dispatch: Dispatch<AnyAction>) => ({
    Actions: bindActionCreators(actionCreator, dispatch)
});

export default connect(mapStateToProps, mapDispatchToProps)(MainPage);