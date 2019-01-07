import * as React from "react";
import { Vector3, Observable } from "babylonjs";
import { NumericInputComponent } from "./numericInputComponent";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";
import { PropertyChangedEvent } from "../../propertyChangedEvent";

interface IVector3LineComponentProps {
    label: string,
    target: any,
    propertyName: string,
    onChange?: (newvalue: Vector3) => void,
    onPropertyChangedObservable?: Observable<PropertyChangedEvent>
}

export class Vector3LineComponent extends React.Component<IVector3LineComponentProps, { isExpanded: boolean, value: Vector3 }> {
    private _localChange = false;

    constructor(props: IVector3LineComponentProps) {
        super(props);

        this.state = { isExpanded: false, value: this.props.target[this.props.propertyName].clone() }
    }

    shouldComponentUpdate(nextProps: IVector3LineComponentProps, nextState: { isExpanded: boolean, value: Vector3 }) {
        const nextPropsValue = nextProps.target[nextProps.propertyName];

        if (!nextPropsValue.equals(nextState.value) || this._localChange) {
            nextState.value = nextPropsValue.clone();
            this._localChange = false;
            return true;
        }
        return false;
    }

    switchExpandState() {
        this._localChange = true;
        this.setState({ isExpanded: !this.state.isExpanded });
    }

    raiseOnPropertyChanged(previousValue: Vector3) {
        if (this.props.onChange) {
            this.props.onChange(this.state.value);
        }

        if (!this.props.onPropertyChangedObservable) {
            return;
        }
        this.props.onPropertyChangedObservable.notifyObservers({
            object: this.props.target,
            property: this.props.propertyName,
            value: this.state.value,
            initialValue: previousValue
        });
    }

    updateStateX(value: number) {
        this._localChange = true;

        const store = this.state.value.clone();
        this.props.target[this.props.propertyName].x = value;
        this.state.value.x = value;
        this.setState({ value: this.state.value });

        this.raiseOnPropertyChanged(store);
    }

    updateStateY(value: number) {
        this._localChange = true;

        const store = this.state.value.clone();
        this.props.target[this.props.propertyName].y = value;
        this.state.value.y = value;
        this.setState({ value: this.state.value });

        this.raiseOnPropertyChanged(store);
    }

    updateStateZ(value: number) {
        this._localChange = true;

        const store = this.state.value.clone();
        this.props.target[this.props.propertyName].z = value;
        this.state.value.z = value;
        this.setState({ value: this.state.value });

        this.raiseOnPropertyChanged(store);
    }

    render() {
        const chevron = this.state.isExpanded ? <FontAwesomeIcon icon={faMinus} /> : <FontAwesomeIcon icon={faPlus} />

        return (
            <div className="vector3Line">
                <div className="firstLine">
                    <div className="label">
                        {this.props.label}
                    </div>
                    <div className="vector">
                        {`X: ${this.state.value.x.toFixed(2)}, Y: ${this.state.value.y.toFixed(2)}, Z: ${this.state.value.z.toFixed(2)}`}

                    </div>
                    <div className="expand hoverIcon" onClick={() => this.switchExpandState()} title="Expand">
                        {chevron}
                    </div>
                </div>
                {
                    this.state.isExpanded &&
                    <div className="secondLine">
                        <NumericInputComponent label="x" value={this.state.value.x} onChange={value => this.updateStateX(value)} />
                        <NumericInputComponent label="y" value={this.state.value.y} onChange={value => this.updateStateY(value)} />
                        <NumericInputComponent label="z" value={this.state.value.z} onChange={value => this.updateStateZ(value)} />
                    </div>
                }
            </div>
        );
    }
}