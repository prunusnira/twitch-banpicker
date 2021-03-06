import React, { Component, Fragment } from "react";
import { Button, ButtonGroup, Card, CardBody, CardHeader, Col, Row } from "reactstrap";
import Message from "../../../data/message";

import './banpick.css';

interface Props {
    picklist: Array<Message>,
    size: number,
    teamname: string,
    teamnum: number,
    phase: number,
    edit: (msg: Message, idx: number) => void,
    remove: (teamNum: number, idx: number) => void,
    ban: (teamNum: number, idx: number) => void,
    nego: (userid: string) => void
}

class BanPickPresenter extends Component<Props> {
    render() {
        const self = this;
        return (
            <Card className="banpicklist">
                <CardHeader className="text-center">
                    {this.props.teamname} (팀 {this.props.teamnum})
                </CardHeader>
                <CardBody id={"banpick-box"+this.props.teamnum} className="banpicklist-body">
                    {
                        this.props.picklist.map((v, i) => {
                            return (
                                <Card>
                                    <CardBody className="banpick-box">
                                        <Row className="no-wrap">
                                            <Col className="no-wrap" xs="10">
                                                <Row>
                                                    <Col xs="12">
                                                        PICK {i+1}
                                                    </Col>
                                                </Row>
                                                <Row>
                                                    <Col className="banpick-content" xs="12">
                                            {
                                                (function() {
                                                    if(v.getBanStatus()) {
                                                        return (
                                                            <del>{v.getMessage()}</del>
                                                        )
                                                    }
                                                    else {
                                                        return v.getMessage()
                                                    }
                                                })()
                                            }
                                            
                                                    </Col>
                                                </Row>
                                                <Row>
                                                    <Col xs="12">
                                                        {v.getTime()} by {v.getUserName()} ({v.getUserId()})
                                                    </Col>
                                                </Row>
                                            </Col>
                                            <Col className="no-wrap" xs="2">
                                                <Row className="no-wrap">
                                                    <Col className="no-wrap" xs="12">
                                                        <ButtonGroup vertical className="banpick-btngroup">
                                                            <Button
                                                                className="banpick-btn"
                                                                size="sm"
                                                                color="dark"
                                                                onClick={() => this.props.edit(v, i)}>수정</Button>
                                                            <Button
                                                                className="banpick-btn"
                                                                size="sm"
                                                                color="dark"
                                                                onClick={() => this.props.remove(this.props.teamnum, i)}>삭제</Button>
                                                            {
                                                                (function() {
                                                                    if(self.props.phase === 1 && v.getBanStatus()) {
                                                                        return (
                                                                            <Button
                                                                                className="banpick-btn"
                                                                                size="sm"
                                                                                color="dark"
                                                                                disabled>언밴</Button>
                                                                        );
                                                                    }
                                                                    else if(self.props.phase === 1 && !v.getBanStatus()) {
                                                                        return (
                                                                            <Button
                                                                                className="banpick-btn"
                                                                                size="sm"
                                                                                color="dark"
                                                                                disabled>밴</Button>
                                                                        );
                                                                    }
                                                                    else if(self.props.phase === 2 && v.getBanStatus()) {
                                                                        return (
                                                                            <Button
                                                                                className="banpick-btn"
                                                                                size="sm"
                                                                                color="dark"
                                                                                onClick={() => self.props.ban(self.props.teamnum, i)}>언밴</Button>
                                                                        );
                                                                    }
                                                                    else if(self.props.phase === 2 && !v.getBanStatus()) {
                                                                        return (
                                                                            <Button
                                                                                className="banpick-btn"
                                                                                size="sm"
                                                                                color="dark"
                                                                                onClick={() => self.props.ban(self.props.teamnum, i)}>밴</Button>
                                                                        );
                                                                    }
                                                                })()
                                                            }
                                                            <Button
                                                                className="banpick-btn"
                                                                size="sm"
                                                                color="dark"
                                                                onClick={() => this.props.nego(v.getUserId())}>협테</Button>
                                                        </ButtonGroup>
                                                    </Col>
                                                </Row>
                                            </Col>
                                        </Row>
                                    </CardBody>
                                </Card>
                            )
                        })
                    }
                </CardBody>
            </Card>
        );
    }
}

export default BanPickPresenter;